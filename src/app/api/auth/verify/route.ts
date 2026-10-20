import { NextResponse } from "next/server";
import { verifyOtp } from "@/lib/auth/demo-server";
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
    return NextResponse.json({
      userId: profile.userId,
      email: profile.email,
      displayName: profile.displayName,
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
    const expired = /expir/i.test(error?.message ?? "");
    return NextResponse.json({ error: expired ? "expired" : "code" }, { status: 400 });
  }

  await supabase.from("profiles").upsert({ id: data.user.id }, { onConflict: "id" });
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", data.user.id)
    .maybeSingle();

  return NextResponse.json({
    userId: data.user.id,
    email: data.user.email ?? email,
    displayName: profile?.display_name ?? null,
    isNew: !profile?.display_name,
  });
}
