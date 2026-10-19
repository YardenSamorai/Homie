import { NextResponse } from "next/server";
import { createHousehold, readHousehold } from "@/lib/auth/demo-server";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "generic" }, { status: 400 });
  const house = readHousehold(id);
  if (!house) return NextResponse.json({ error: "missing" }, { status: 404 });
  return NextResponse.json(house);
}

export async function POST(request: Request) {
  const { userId, name } = (await request.json().catch(() => ({}))) as { userId?: string; name?: string };
  if (!userId || !name?.trim()) return NextResponse.json({ error: "generic" }, { status: 400 });
  return NextResponse.json(createHousehold(userId, name.trim()));
}
