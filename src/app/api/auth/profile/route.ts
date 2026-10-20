import { NextResponse } from "next/server";
import { saveDisplayName } from "@/lib/auth/demo-server";
import { supabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { userId, displayName } = (await request.json().catch(() => ({}))) as {
    userId?: string;
    displayName?: string;
  };
  const name = displayName?.trim();
  if (!name) return NextResponse.json({ error: "name" }, { status: 400 });

  if (!supabaseConfigured()) {
    if (!userId) return NextResponse.json({ error: "name" }, { status: 400 });
    const profile = saveDisplayName(userId, name);
    if (!profile) return NextResponse.json({ error: "generic" }, { status: 404 });
    return NextResponse.json(profile);
  }

  const supabase = await createServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return NextResponse.json({ error: "generic" }, { status: 401 });

  const { error } = await supabase.from("profiles").update({ display_name: name }).eq("id", user.id);
  if (error) return NextResponse.json({ error: "generic" }, { status: 400 });
  return NextResponse.json({ userId: user.id, email: user.email, displayName: name });
}
