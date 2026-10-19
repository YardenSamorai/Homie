import { NextResponse } from "next/server";
import { sendOtp } from "@/lib/auth/demo-server";

export async function POST(request: Request) {
  const { email } = (await request.json().catch(() => ({}))) as { email?: string };
  const result = sendOtp(email ?? "");
  if (!result.ok) {
    return NextResponse.json({ error: result.error, retryAfter: result.retryAfter }, { status: 400 });
  }
  return NextResponse.json({ resendAt: result.resendAt });
}
