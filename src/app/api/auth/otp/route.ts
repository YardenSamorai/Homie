import { NextResponse } from "next/server";
import { sendOtp } from "@/lib/auth/demo-server";
import { OTP_RESEND_MS, emailPattern } from "@/lib/auth/constants";
import { hasLocale } from "@/i18n/config";
import { supabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { email, locale } = (await request.json().catch(() => ({}))) as { email?: string; locale?: string };
  const clean = (email ?? "").trim().toLowerCase();

  if (!supabaseConfigured()) {
    const result = sendOtp(clean);
    if (!result.ok) {
      return NextResponse.json({ error: result.error, retryAfter: result.retryAfter }, { status: 400 });
    }
    return NextResponse.json({ resendAt: result.resendAt });
  }

  if (!emailPattern.test(clean)) return NextResponse.json({ error: "email" }, { status: 400 });

  const lang = hasLocale(locale) ? locale : "he";
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithOtp({
    email: clean,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${new URL(request.url).origin}/api/auth/callback?lang=${lang}`,
    },
  });
  if (error) {
    if (error.code === "email_address_invalid") return NextResponse.json({ error: "email" }, { status: 400 });
    const seconds = Number(/(\d+)\s*second/i.exec(error.message)?.[1]);
    if (/rate|limit|seconds|security purposes/i.test(error.message)) {
      return NextResponse.json({ error: "wait", retryAfter: Number.isFinite(seconds) ? seconds : 60 }, { status: 429 });
    }
    return NextResponse.json({ error: "send" }, { status: 400 });
  }
  return NextResponse.json({ resendAt: Date.now() + OTP_RESEND_MS });
}
