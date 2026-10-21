import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { INVITE_COOKIE } from "@/lib/auth/constants";
import { createInvite, readInvite } from "@/lib/auth/demo-server";
import { supabaseConfigured } from "@/lib/supabase/env";
import { createInviteForUser, previewInvite } from "@/lib/supabase/household";

function clearCookie() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
    secure: process.env.NODE_ENV === "production",
  };
}

export async function GET() {
  const token = (await cookies()).get(INVITE_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({
      status: "missing",
      token: "",
      householdId: null,
      householdName: null,
      inviterName: null,
      expiresAt: null,
    });
  }
  return NextResponse.json(supabaseConfigured() ? await previewInvite(token) : readInvite(token));
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    householdId?: string;
    householdName?: string;
    inviterName?: string;
    inviterUserId?: string;
  };
  if (!body.householdName?.trim() || !body.inviterName?.trim()) {
    return NextResponse.json({ error: "generic" }, { status: 400 });
  }
  if (supabaseConfigured()) {
    const invite = await createInviteForUser();
    if (!invite) return NextResponse.json({ error: "generic" }, { status: 400 });
    return NextResponse.json(invite);
  }
  return NextResponse.json(
    createInvite({
      householdId: body.householdId,
      householdName: body.householdName,
      inviterName: body.inviterName,
      inviterUserId: body.inviterUserId,
    }),
  );
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(INVITE_COOKIE, "", clearCookie());
  return res;
}
