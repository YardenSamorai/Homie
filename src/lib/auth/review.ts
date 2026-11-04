import "server-only";
import { timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The App Review sign-in: one address (APP_REVIEW_EMAIL) that gets no email and takes one fixed six-digit code
 * (APP_REVIEW_CODE) instead. It opens a demo home of its own, rebuilt when it's missing or a day old, so a reviewer
 * who deleted the account or emptied the lists finds it whole the next time. Unset either variable to turn it off.
 */
export function reviewAccount() {
  const email = process.env.APP_REVIEW_EMAIL?.trim().toLowerCase();
  const code = process.env.APP_REVIEW_CODE?.trim();
  return email && code && /^\d{6}$/.test(code) ? { email, code } : null;
}

export const isReviewEmail = (email: string) => reviewAccount()?.email === email.trim().toLowerCase();

const MAX_FAILURES = 5;
const LOCK_MS = 5 * 60 * 1000;
const failures = { count: 0, until: 0 };

/** The code check, locked for a few minutes after repeated misses (per server instance). */
export function checkReviewCode(code: string): "ok" | "invalid" | "locked" {
  const account = reviewAccount();
  if (!account) return "invalid";
  if (failures.until > Date.now()) return "locked";
  const given = Buffer.from(code.trim().padEnd(6).slice(0, 6));
  if (timingSafeEqual(given, Buffer.from(account.code))) {
    failures.count = 0;
    return "ok";
  }
  failures.count += 1;
  if (failures.count >= MAX_FAILURES) {
    failures.count = 0;
    failures.until = Date.now() + LOCK_MS;
  }
  return "invalid";
}

const ZONE = "America/Los_Angeles";
const REBUILD_MS = 24 * 60 * 60 * 1000;

const partnerEmail = (email: string) => email.replace("@", "+partner@");

/** Finds or creates a confirmed sign-in, and returns its id with a one-time token for it. */
async function signInFor(admin: SupabaseClient, email: string) {
  const created = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (created.error && created.error.code !== "email_exists") throw created.error;
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (link.error || !link.data.user) throw link.error ?? new Error("review link");
  return { id: link.data.user.id, token: link.data.properties.hashed_token };
}

function day(offset: number) {
  const date = new Date(Date.now() + offset * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

const must = async (work: PromiseLike<{ error: unknown }>) => {
  const { error } = await work;
  if (error) throw error;
};

/** A lived-in home for two: today's tasks and plans, a shopping list, tomorrow's prep and a note. */
async function buildHouse(admin: SupabaseClient, me: string, partner: string) {
  const { data: house, error } = await admin
    .from("households")
    .insert({ name: "Alex & Sam", timezone: ZONE, created_by: me })
    .select("id")
    .single();
  if (error || !house) throw error ?? new Error("review house");
  const household = house.id as string;
  await must(
    admin.from("household_members").insert([
      { household_id: household, user_id: me, role: "admin", color: "#5a5f94" },
      { household_id: household, user_id: partner, role: "member", color: "#c48b9f" },
    ]),
  );
  const today = day(0);
  const tomorrow = day(1);
  await must(
    admin.from("tasks").insert([
      { household_id: household, title: "Pay the electricity bill", assignee_id: me, due_date: today, created_by: partner },
      { household_id: household, title: "Water the plants", assignee_id: me, due_date: today, recurrence: "weekly", created_by: me },
      { household_id: household, title: "Book a dentist appointment", assignee_id: partner, due_date: today, created_by: me },
      { household_id: household, title: "Pick up the dry cleaning", assignee_id: partner, due_date: tomorrow, created_by: partner },
      { household_id: household, title: "Take out the recycling", assignee_id: me, due_date: today, created_by: partner, completed_at: new Date().toISOString(), completed_by: me },
    ]),
  );
  await must(
    admin.from("events").insert([
      { household_id: household, title: "Parent-teacher meeting", date: today, time: "17:30", attendee_id: me, created_by: partner },
      { household_id: household, title: "Dinner with Mia and Leo", date: today, time: "19:30", created_by: me },
      { household_id: household, title: "Soccer practice", date: tomorrow, time: "08:00", prep_note: "Shin guards and a water bottle", attendee_id: partner, created_by: partner },
    ]),
  );
  await must(
    admin.from("shopping_items").insert([
      { household_id: household, name: "Milk", category: "dairy", quantity: 2, unit: "unit", added_by: partner },
      { household_id: household, name: "Eggs", category: "dairy", quantity: 12, unit: "unit", added_by: me },
      { household_id: household, name: "Bananas", category: "produce", added_by: partner },
      { household_id: household, name: "Whole wheat bread", category: "bakery", added_by: me },
      { household_id: household, name: "Coffee beans", category: "pantry", quantity_note: "The dark roast", added_by: partner },
      { household_id: household, name: "Dish soap", category: "cleaning", added_by: me },
    ]),
  );
  await must(admin.from("house_notes").insert({ household_id: household, body: "Grandma visits on Saturday, lunch at 1.", author_id: partner }));
}

/**
 * Makes sure the review account and its home are there and fresh, then returns a one-time token that signs the
 * reviewer in. Runs with the service key, only after the fixed code matched.
 */
export async function prepareReviewSignIn(admin: SupabaseClient, email: string) {
  const me = await signInFor(admin, email);
  const partner = await signInFor(admin, partnerEmail(email));
  await must(
    admin.from("profiles").upsert([
      { id: me.id, display_name: "Alex", locale: "en" },
      { id: partner.id, display_name: "Sam", locale: "en" },
    ]),
  );

  const { data: membership } = await admin
    .from("household_members")
    .select("household_id, households(created_at)")
    .eq("user_id", me.id)
    .maybeSingle();
  const created = (membership?.households as { created_at?: string } | null)?.created_at;
  const stale = !membership || !created || Date.now() - new Date(created).getTime() > REBUILD_MS;
  if (stale) {
    // Both homes go: after the reviewer deleted the account, the old demo home passed to the partner.
    const { data: homes } = await admin.from("household_members").select("household_id").in("user_id", [me.id, partner.id]);
    const ids = [...new Set((homes ?? []).map((row) => row.household_id as string))];
    if (ids.length > 0) await must(admin.from("households").delete().in("id", ids));
    await must(admin.from("profiles").update({ prefs: {} }).eq("id", me.id));
    await buildHouse(admin, me.id, partner.id);
  }
  return me.token;
}
