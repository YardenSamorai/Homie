import { NextResponse } from "next/server";
import { householdFor, verifyOtp } from "@/lib/auth/demo-server";
import { readAccount } from "@/lib/supabase/account";
import { supabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { email, code } = (await request.json().catch(() => ({}))) as { email?: string; code?: string };
  if (!supabaseConfigured()) {
    const result = verifyOtp(email ?? "", code ?? "");
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
  const { data, error } = await supabase.auth.verifyOtp({
    email: (email ?? "").trim(),
    token: (code ?? "").trim(),
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
