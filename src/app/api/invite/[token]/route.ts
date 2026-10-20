import { NextResponse } from "next/server";
import { INVITE_COOKIE } from "@/lib/auth/constants";
import { readInvite } from "@/lib/auth/demo-server";
import { supabaseConfigured } from "@/lib/supabase/env";
import { previewInvite } from "@/lib/supabase/household";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const invite = supabaseConfigured() ? await previewInvite(token) : readInvite(token);
  const res = NextResponse.json(invite);
  if (invite.status === "ok") {
    const maxAge = invite.expiresAt ? Math.max(0, Math.floor((Date.parse(invite.expiresAt) - Date.now()) / 1000)) : 0;
    res.cookies.set(INVITE_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge,
      secure: process.env.NODE_ENV === "production",
    });
  }
  return res;
}
