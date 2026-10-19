import { NextResponse } from "next/server";
import { verifyOtp } from "@/lib/auth/demo-server";

export async function POST(request: Request) {
  const { email, code } = (await request.json().catch(() => ({}))) as { email?: string; code?: string };
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
