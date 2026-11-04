import { NextResponse } from "next/server";
import { householdFor, verifyOtp } from "@/lib/auth/demo-server";
import { checkReviewCode, isReviewEmail, prepareReviewSignIn } from "@/lib/auth/review";
import { readAccount } from "@/lib/supabase/account";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { supabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { email?: unknown; code?: unknown };
  const email = typeof body.email === "string" ? body.email : "";
  const code = typeof body.code === "string" ? body.code : "";
  if (!supabaseConfigured()) {
    const result = verifyOtp(email, code);
    if (!result.ok) {
      return NextResponse.json({ error: result.error, retryAfter: result.retryAfter }, { status: 400 });
    }
    const { profile, isNew } = result;
    const house = householdFor(profile.userId);
    return NextResponse.json({
      userId: profile.userId,
      email: profile.email,
      displayName: profile.displayName,
      householdId: house?.id ?? null,
      householdName: house?.name ?? null,
      role: house?.role ?? null,
      isNew,
    });
  }

  const supabase = await createServerSupabase();
  if (isReviewEmail(email)) return reviewSignIn(supabase, email, code);
  const { data, error } = await supabase.auth.verifyOtp({
    email: email.trim(),
    token: code.trim(),
    type: "email",
  });
  if (error || !data.user) {
    // Supabase answers a wrong code and an expired one with the same error, so both read as "doesn't match".
    const message = error?.message ?? "";
    const reason = /rate|too many/i.test(message) || error?.status === 429 ? "locked" : "invalid";
    return NextResponse.json({ error: reason, retryAfter: reason === "locked" ? 60 : undefined }, { status: 400 });
  }

  await supabase.from("profiles").upsert({ id: data.user.id }, { onConflict: "id", ignoreDuplicates: true });
  const account = await readAccount(supabase, data.user);
  return NextResponse.json({ ...account, isNew: !account.displayName });
}

async function reviewSignIn(supabase: Awaited<ReturnType<typeof createServerSupabase>>, email: string, code: string) {
  const check = checkReviewCode(code);
  if (check !== "ok") return NextResponse.json({ error: check, retryAfter: check === "locked" ? 300 : undefined }, { status: 400 });
  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: "invalid" }, { status: 400 });
  try {
    const token = await prepareReviewSignIn(admin, email.trim().toLowerCase());
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: token, type: "magiclink" });
    if (error || !data.user) throw error ?? new Error("review session");
    const account = await readAccount(supabase, data.user);
    return NextResponse.json({ ...account, isNew: false });
  } catch (error) {
    console.error("[homie] review sign-in failed", error);
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
}
