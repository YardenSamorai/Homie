import { NextResponse } from "next/server";
import { createHousehold } from "@/lib/auth/demo-server";

export async function POST(request: Request) {
  const { userId, name } = (await request.json().catch(() => ({}))) as { userId?: string; name?: string };
  if (!userId || !name?.trim()) return NextResponse.json({ error: "generic" }, { status: 400 });
  return NextResponse.json(createHousehold(userId, name.trim()));
}
