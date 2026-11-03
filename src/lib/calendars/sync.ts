import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dayIn, type Provider } from "./normalize";
import { planBatch, type PlannedEvent } from "./plan";
import { listCalendars, ProviderError, readChanges, refreshTokens, revokeTokens, type RemoteCalendar, type Tokens } from "./providers";
import { seal, stableKey, unseal } from "./seal";

type Admin = SupabaseClient;

/** Days around today that are imported. Further out arrives as the window moves (a fresh full read each week). */
export const WINDOW_BACK_DAYS = 14;
export const WINDOW_AHEAD_DAYS = 120;
const FULL_EVERY_MS = 7 * 86_400_000;
const DAY_MS = 86_400_000;

export type Account = { id: string; user_id: string; provider: Provider; subject: string; email: string; status: string };
type Source = { id: string; remote_id: string; source_key: string };
export type SyncOutcome = "synced" | "busy" | "reauth" | "failed";

export async function loadTokens(admin: Admin, accountId: string): Promise<Tokens | null> {
  const { data } = await admin.from("calendar_secrets").select("sealed").eq("account_id", accountId).maybeSingle();
  const plain = data?.sealed ? unseal(data.sealed as string, accountId) : null;
  if (!plain) return null;
  try {
    return JSON.parse(plain) as Tokens;
  } catch {
    return null;
  }
}

export async function saveTokens(admin: Admin, accountId: string, tokens: Tokens) {
  const { error } = await admin
    .from("calendar_secrets")
    .upsert({ account_id: accountId, sealed: seal(JSON.stringify(tokens), accountId), updated_at: new Date().toISOString() });
  if (error) throw new Error("secrets");
}

/** New calendars arrive unchosen and private; ones the account no longer lists are set aside, not deleted. */
export async function storeCalendars(admin: Admin, account: Account, calendars: RemoteCalendar[]) {
  if (calendars.length > 0) {
    const { error } = await admin.from("calendar_sources").upsert(
      calendars.map((calendar) => ({
        account_id: account.id,
        user_id: account.user_id,
        remote_id: calendar.remoteId,
        source_key: stableKey(account.provider, account.subject, calendar.remoteId),
        name: calendar.name,
        color: calendar.color,
        is_primary: calendar.isPrimary,
        gone_at: null,
      })),
      { onConflict: "account_id,remote_id" },
    );
    if (error) throw new Error("calendars");
  }
  const { data: known } = await admin.from("calendar_sources").select("id, remote_id, gone_at").eq("account_id", account.id);
  const listed = new Set(calendars.map((calendar) => calendar.remoteId));
  const missing = (known ?? []).filter((row) => !listed.has(row.remote_id as string) && !row.gone_at).map((row) => row.id as string);
  if (missing.length > 0) await admin.from("calendar_sources").update({ gone_at: new Date().toISOString() }).in("id", missing);
}

/** Each member's proven addresses: the email they sign in with and the accounts they connected. */
async function memberAddresses(admin: Admin, householdId: string) {
  const { data: members } = await admin.from("household_members").select("user_id").eq("household_id", householdId);
  const ids = (members ?? []).map((row) => row.user_id as string);
  const addresses = new Map<string, Set<string>>(ids.map((id) => [id, new Set<string>()]));
  await Promise.all(
    ids.map(async (id) => {
      const { data } = await admin.auth.admin.getUserById(id);
      if (data.user?.email && data.user.email_confirmed_at) addresses.get(id)!.add(data.user.email.toLowerCase());
    }),
  );
  const { data: accounts } = await admin.from("calendar_accounts").select("user_id, email").in("user_id", ids);
  for (const row of accounts ?? []) addresses.get(row.user_id as string)?.add((row.email as string).toLowerCase());
  return addresses;
}

const safeLink = (link: string | null) => (link && /^https:\/\//i.test(link) ? link.slice(0, 2000) : null);

type Context = {
  account: Account;
  householdId: string;
  timeZone: string;
  addresses: Map<string, Set<string>>;
  access: () => Promise<string>;
  renew: () => Promise<string>;
};

function rowFor(ctx: Context, source: Source, event: PlannedEvent, run: string) {
  return {
    source_id: source.id,
    household_id: ctx.householdId,
    owner_id: ctx.account.user_id,
    remote_id: event.remoteId,
    fix_key: stableKey(ctx.account.provider, ctx.account.subject, source.remote_id, event.remoteId),
    series_id: event.seriesId,
    ical_uid: event.icalUid,
    title: event.title?.slice(0, 300) ?? null,
    all_day: event.allDay,
    starts_at: event.startsAt,
    ends_at: event.endsAt,
    start_day: event.startDay,
    end_day: event.endDay,
    tentative: event.tentative,
    busy: event.busy,
    marked_private: event.markedPrivate,
    people: event.people,
    declined: event.declined,
    link: safeLink(event.link),
    updated_at: new Date().toISOString(),
    seen_in: run,
  };
}

const chunks = <T,>(items: T[], size: number) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, index * size + size));

/** Runs a provider call, renewing the access token once if the provider says it's no longer good. */
async function withAccess<T>(ctx: Context, work: (access: string) => Promise<T>): Promise<T> {
  try {
    return await work(await ctx.access());
  } catch (error) {
    if (error instanceof ProviderError && error.failure === "reauth") return work(await ctx.renew());
    throw error;
  }
}

async function syncSource(admin: Admin, ctx: Context, source: Source) {
  const { data: state } = await admin.from("calendar_sync_state").select("*").eq("source_id", source.id).maybeSingle();
  const now = Date.now();
  const window = { start: new Date(now - WINDOW_BACK_DAYS * DAY_MS), end: new Date(now + WINDOW_AHEAD_DAYS * DAY_MS) };
  const startOver = !state?.cursor || !state.full_at || now - Date.parse(state.full_at as string) > FULL_EVERY_MS;
  const readAll = () => withAccess(ctx, (access) => readChanges(ctx.account.provider, access, source.remote_id, { window }));

  let batch;
  if (startOver) batch = await readAll();
  else {
    try {
      batch = await withAccess(ctx, (access) => readChanges(ctx.account.provider, access, source.remote_id, { cursor: state.cursor as string }));
    } catch (error) {
      // The provider dropped the sync state (expired token, changed sharing): read everything again.
      if (!(error instanceof ProviderError && error.failure === "gone")) throw error;
      batch = await readAll();
    }
  }

  const covered = batch.full ? window : { start: new Date(state!.window_start as string), end: new Date(state!.window_end as string) };
  const fromDay = dayIn(covered.start, ctx.timeZone);
  const toDay = dayIn(covered.end, ctx.timeZone);
  const run = randomUUID();

  const plan = planBatch(batch.changes, { ownerId: ctx.account.user_id, addresses: ctx.addresses, timeZone: ctx.timeZone, fromDay, toDay });
  const rows = plan.write.map((event) => rowFor(ctx, source, event, run));
  const removed = plan.remove;

  for (const part of chunks(rows, 200)) {
    const { error } = await admin.from("calendar_events").upsert(part, { onConflict: "source_id,remote_id" });
    if (error) throw new Error("events");
  }
  if (batch.full) {
    // Every page arrived, so what this run didn't see is no longer in the window or no longer exists.
    const { error } = await admin.from("calendar_events").delete().eq("source_id", source.id).or(`seen_in.is.null,seen_in.neq.${run}`);
    if (error) throw new Error("sweep");
  } else {
    for (const part of chunks(removed, 100)) {
      await admin.from("calendar_events").delete().eq("source_id", source.id).in("remote_id", part);
      // A cancelled series arrives as its master's id: its instances go with it.
      await admin.from("calendar_events").delete().eq("source_id", source.id).in("series_id", part);
    }
  }

  const { error } = await admin.from("calendar_sync_state").upsert({
    source_id: source.id,
    cursor: batch.cursor,
    window_start: covered.start.toISOString(),
    window_end: covered.end.toISOString(),
    full_at: batch.full ? new Date().toISOString() : state?.full_at,
  });
  if (error) throw new Error("state");
  await admin.from("calendar_sources").update({ last_synced_at: new Date().toISOString(), last_error: null }).eq("id", source.id);
}

const failureOf = (error: unknown) => (error instanceof ProviderError ? error.failure : "unavailable");

/**
 * One account, start to finish: renew the token if needed, refresh the list of calendars, then each chosen
 * calendar. A failure stops only that calendar and is recorded as it is; nothing already imported is removed for it.
 * `minGapMs` is a lease: a second run for the same account inside that gap (another tab, the cron) steps back.
 */
export async function syncAccount(admin: Admin, accountId: string, minGapMs = 2 * 60_000): Promise<SyncOutcome> {
  const started = new Date();
  const cutoff = new Date(started.getTime() - minGapMs).toISOString();
  const { data: account } = await admin
    .from("calendar_accounts")
    .update({ last_attempt_at: started.toISOString() })
    .eq("id", accountId)
    .or(`last_attempt_at.is.null,last_attempt_at.lt.${cutoff}`)
    .select("id, user_id, provider, subject, email, status")
    .maybeSingle();
  if (!account) return "busy";

  const mark = (patch: Record<string, unknown>) => admin.from("calendar_accounts").update(patch).eq("id", accountId);
  let tokens = await loadTokens(admin, accountId);
  if (!tokens) {
    await mark({ status: "reauth", last_error: "reauth" });
    return "reauth";
  }
  const renew = async () => {
    tokens = await refreshTokens(account.provider as Provider, tokens!);
    await saveTokens(admin, accountId, tokens);
    return tokens.access;
  };

  try {
    const ctx: Context = {
      account: account as Account,
      householdId: "",
      timeZone: "Asia/Jerusalem",
      addresses: new Map(),
      access: async () => (tokens!.expiresAt - 60_000 > Date.now() ? tokens!.access : renew()),
      renew,
    };
    await storeCalendars(admin, ctx.account, await withAccess(ctx, (access) => listCalendars(ctx.account.provider, access)));

    const { data: membership } = await admin
      .from("household_members")
      .select("household_id, households(timezone)")
      .eq("user_id", account.user_id)
      .maybeSingle();
    if (!membership) {
      await mark({ status: "active", last_error: null, last_synced_at: new Date().toISOString() });
      return "synced";
    }
    ctx.householdId = membership.household_id as string;
    const house = membership.households as { timezone?: string } | { timezone?: string }[] | null;
    ctx.timeZone = (Array.isArray(house) ? house[0]?.timezone : house?.timezone) || "Asia/Jerusalem";
    ctx.addresses = await memberAddresses(admin, ctx.householdId);

    const { data: sources } = await admin
      .from("calendar_sources")
      .select("id, remote_id, source_key")
      .eq("account_id", accountId)
      .eq("selected", true)
      .is("gone_at", null);

    let firstFailure: string | null = null;
    for (const source of (sources ?? []) as Source[]) {
      try {
        await syncSource(admin, ctx, source);
      } catch (error) {
        if (error instanceof ProviderError && error.failure === "reauth") throw error;
        const failure = failureOf(error);
        firstFailure ??= failure;
        await admin.from("calendar_sources").update({ last_error: failure }).eq("id", source.id);
      }
    }
    await mark(
      firstFailure
        ? { status: "active", last_error: firstFailure }
        : { status: "active", last_error: null, last_synced_at: new Date().toISOString() },
    );
    return firstFailure ? "failed" : "synced";
  } catch (error) {
    const failure = failureOf(error);
    if (failure === "reauth" || failure === "scope") {
      await mark({ status: "reauth", last_error: failure });
      return "reauth";
    }
    await mark({ last_error: failure });
    return "failed";
  }
}

/** Accounts not synced for a while, oldest first. People asked to reconnect are left until they do. */
export async function syncDue(admin: Admin, options: { userIds?: string[]; olderThanMs: number; limit: number }) {
  let query = admin
    .from("calendar_accounts")
    .select("id")
    .neq("status", "reauth")
    .or(`last_synced_at.is.null,last_synced_at.lt.${new Date(Date.now() - options.olderThanMs).toISOString()}`)
    .order("last_synced_at", { ascending: true, nullsFirst: true })
    .limit(options.limit);
  if (options.userIds) query = query.in("user_id", options.userIds);
  const { data } = await query;
  const outcomes: SyncOutcome[] = [];
  for (const row of data ?? []) outcomes.push(await syncAccount(admin, row.id as string));
  return outcomes;
}

/**
 * Disconnecting: the provider is told (Google), then the account goes with its tokens, calendars, imported events
 * and the house's notes on them. Nothing at the source changes.
 */
export async function disconnectAccount(admin: Admin, account: Account) {
  const tokens = await loadTokens(admin, account.id);
  if (tokens) await revokeTokens(account.provider, tokens);
  const { data: sources } = await admin.from("calendar_sources").select("source_key").eq("account_id", account.id);
  const keys = (sources ?? []).map((row) => row.source_key as string);
  if (keys.length > 0) await admin.from("calendar_event_fixes").delete().in("source_key", keys);
  const { error } = await admin.from("calendar_accounts").delete().eq("id", account.id);
  if (error) throw new Error("disconnect");
}
