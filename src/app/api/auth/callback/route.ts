import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { hasLocale } from "@/i18n/config";
import { supabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabase } from "@/lib/supabase/server";

/** The sign-in email also carries a link. Opening it signs in here, then the door finishes routing. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const lang = url.searchParams.get("lang") ?? undefined;
  const door = new URL(`/${hasLocale(lang) ? lang : "he"}/login`, url.origin);
  if (!supabaseConfigured()) return NextResponse.redirect(door);

  const supabase = await createServerSupabase();
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error("missing") };

  if (error) door.searchParams.set("link", "expired");
  return NextResponse.redirect(door);
}
