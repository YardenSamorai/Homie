import { NextResponse } from "next/server";
import { createHousehold, readHousehold, renameHousehold } from "@/lib/auth/demo-server";
import { supabaseConfigured } from "@/lib/supabase/env";
import { createHouseholdForUser, readHouseholdForUser, renameHouseholdForUser } from "@/lib/supabase/household";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "generic" }, { status: 400 });
  const house = supabaseConfigured() ? await readHouseholdForUser(id) : readHousehold(id);
  if (!house) return NextResponse.json({ error: "missing" }, { status: 404 });
  return NextResponse.json(house);
}

export async function POST(request: Request) {
  const { userId, name } = (await request.json().catch(() => ({}))) as { userId?: string; name?: string };
  if (!name?.trim()) return NextResponse.json({ error: "generic" }, { status: 400 });
  if (supabaseConfigured()) {
    const house = await createHouseholdForUser(name.trim());
    if (!house) return NextResponse.json({ error: "generic" }, { status: 400 });
    return NextResponse.json(house);
  }
  if (!userId) return NextResponse.json({ error: "generic" }, { status: 400 });
  return NextResponse.json(createHousehold(userId, name.trim()));
}

export async function PATCH(request: Request) {
  const { id, userId, name } = (await request.json().catch(() => ({}))) as {
    id?: string;
    userId?: string;
    name?: string;
  };
  if (!id || !name?.trim()) return NextResponse.json({ error: "generic" }, { status: 400 });
  const house = supabaseConfigured()
    ? await renameHouseholdForUser(id, name.trim())
    : userId
      ? renameHousehold(id, name.trim(), userId)
      : null;
  if (!house) return NextResponse.json({ error: "missing" }, { status: 404 });
  return NextResponse.json(house);
}
