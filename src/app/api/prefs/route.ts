import { NextResponse } from "next/server";
import { applyChanges, validChange, type Prefs } from "@/lib/prefs";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { supabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabase } from "@/lib/supabase/server";

const MAX_CHANGES = 80;

/**
 * Saves some of this parent's choices. Each change lands at its own path and the whole set is read back through
 * readPrefs, so only known fields with valid values are stored. The write only succeeds against the revision it
 * read; a save from another device in between is read again and kept, never overwritten.
 */
export async function PATCH(request: Request) {
  if (!supabaseConfigured()) return NextResponse.json({ error: "unavailable" }, { status: 404 });
  const body = (await request.json().catch(() => null)) as { changes?: unknown } | null;
  const changes = Array.isArray(body?.changes) ? body.changes : null;
  if (!changes || changes.length === 0 || changes.length > MAX_CHANGES || !changes.every(validChange)) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const db = await createServerSupabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: "unavailable" }, { status: 503 });

  for (let attempt = 0; attempt < 4; attempt++) {
    const { data: row, error } = await admin.from("profiles").select("prefs, prefs_rev").eq("id", user.id).maybeSingle();
    if (error || !row) return NextResponse.json({ error: "generic" }, { status: 500 });
    const next = ownPhotoOnly(applyChanges(row.prefs, changes), user.id);
    const { data: saved, error: writeError } = await admin
      .from("profiles")
      .update({ prefs: next })
      .eq("id", user.id)
      .eq("prefs_rev", row.prefs_rev)
      .select("prefs_rev")
      .maybeSingle();
    if (writeError) return NextResponse.json({ error: "generic" }, { status: 500 });
    if (saved) return NextResponse.json({ prefs: next, rev: saved.prefs_rev });
  }
  return NextResponse.json({ error: "busy" }, { status: 409 });
}

/** A background photo is always one of this parent's own files. */
function ownPhotoOnly(prefs: Prefs, userId: string): Prefs {
  const photo = prefs.look.background.photo;
  if (!photo || photo.path.startsWith(`backgrounds/${userId}/`)) return prefs;
  const background = { ...prefs.look.background, photo: null, kind: prefs.look.background.kind === "photo" ? ("plain" as const) : prefs.look.background.kind };
  return { ...prefs, look: { ...prefs.look, background } };
}
