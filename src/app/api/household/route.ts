import { NextResponse } from "next/server";
import { createHousehold, readHousehold, renameHousehold } from "@/lib/auth/demo-server";

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

export async function PATCH(request: Request) {
  const { id, userId, name } = (await request.json().catch(() => ({}))) as {
    id?: string;
    userId?: string;
    name?: string;
  };
  if (!id || !userId || !name?.trim()) return NextResponse.json({ error: "generic" }, { status: 400 });
  const house = renameHousehold(id, name.trim(), userId);
  if (!house) return NextResponse.json({ error: "missing" }, { status: 404 });
  return NextResponse.json(house);
}
