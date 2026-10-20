import { NextResponse } from "next/server";
import { sendOtp } from "@/lib/auth/demo-server";
import { OTP_RESEND_MS } from "@/lib/auth/constants";
import { supabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { email } = (await request.json().catch(() => ({}))) as { email?: string };
  if (!supabaseConfigured()) {
    const result = sendOtp(email ?? "");
    if (!result.ok) {
      return NextResponse.json({ error: result.error, retryAfter: result.retryAfter }, { status: 400 });
    }
    return NextResponse.json({ resendAt: result.resendAt });
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithOtp({
    email: (email ?? "").trim(),
    options: { shouldCreateUser: true },
  });
  if (error) {
    const tooMany = /rate|limit|seconds/i.test(error.message);
    return NextResponse.json(
      { error: tooMany ? "tooMany" : "send", retryAfter: tooMany ? 60 : undefined },
      { status: 400 },
    );
  }
  return NextResponse.json({ resendAt: Date.now() + OTP_RESEND_MS });
}
