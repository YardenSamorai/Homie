import { NextResponse } from "next/server";
import { readAccount } from "@/lib/supabase/account";
import { supabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabase } from "@/lib/supabase/server";

/** Picks up a session that began outside the form, such as the link in the sign-in email. */
export async function GET() {
  if (!supabaseConfigured()) return NextResponse.json({ account: null });
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ account: null });
  return NextResponse.json({ account: await readAccount(supabase, data.user) });
}
