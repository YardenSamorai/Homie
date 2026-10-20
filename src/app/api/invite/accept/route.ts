import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { INVITE_COOKIE } from "@/lib/auth/constants";
import { acceptInvite } from "@/lib/auth/demo-server";
import { supabaseConfigured } from "@/lib/supabase/env";
import { acceptInviteForUser } from "@/lib/supabase/household";

function clearCookie() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
    secure: process.env.NODE_ENV === "production",
  };
}

export async function POST(request: Request) {
  const { userId } = (await request.json().catch(() => ({}))) as { userId?: string };
  const token = (await cookies()).get(INVITE_COOKIE)?.value;
  if (!userId || !token) return NextResponse.json({ error: "missing" }, { status: 400 });

  const result = supabaseConfigured() ? await acceptInviteForUser(token) : userId ? acceptInvite(token, userId) : { ok: false as const, status: "missing" as const };
  if (!result.ok) {
    const res = NextResponse.json({ error: result.status }, { status: 409 });
    if (result.status !== "already") res.cookies.set(INVITE_COOKIE, "", clearCookie());
    return res;
  }

  const res = NextResponse.json(result);
  res.cookies.set(INVITE_COOKIE, "", clearCookie());
  return res;
}
