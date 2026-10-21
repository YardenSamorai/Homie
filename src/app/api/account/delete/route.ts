import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { supabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Deletes the signed-in parent's account for good (Apple requires it in the app). What they held in a home
 * passes to whoever stays (prepare_account_deletion, 0009); their photos go; then the sign-in itself.
 */
export async function POST() {
  if (!supabaseConfigured()) return NextResponse.json({ error: "generic" }, { status: 404 });
  // Checked before anything changes: without it the sign-in couldn't be deleted at the end.
  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: "unavailable" }, { status: 503 });

  const db = await createServerSupabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });

  const { data: membership } = await db.from("household_members").select("household_id").eq("user_id", user.id).maybeSingle();

  const prepared = await db.rpc("prepare_account_deletion");
  if (prepared.error) {
    console.error("[account] prepare failed", prepared.error.message);
    return NextResponse.json({ error: "generic" }, { status: 400 });
  }

  const files = async (bucket: string, folder: string) => {
    const { data } = await admin.storage.from(bucket).list(folder, { limit: 1000 });
    const paths = (data ?? []).map((file) => `${folder}/${file.name}`);
    if (paths.length > 0) await admin.storage.from(bucket).remove(paths);
  };
  await Promise.all([
    files("avatars", user.id),
    files("house-media", `avatars/${user.id}`),
    membership ? files("house-media", `stories/${membership.household_id}/${user.id}`) : Promise.resolve(),
  ]);

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error("[account] delete failed", error.message);
    return NextResponse.json({ error: "generic" }, { status: 400 });
  }
  return NextResponse.json({ deleted: true });
}
