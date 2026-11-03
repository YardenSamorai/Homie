import { NextResponse } from "next/server";
import sharp from "sharp";
import { readPrefs } from "@/lib/prefs";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { supabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabase } from "@/lib/supabase/server";

/** Under the hosting's request limit; the app sends a redrawn photo of about 1 MB. */
const MAX_BYTES = 4 * 1024 * 1024;
const MAX_PIXELS = 60_000_000;
const SIDE = 2400;
const formats = new Set(["jpeg", "png", "webp", "heif"]);
const bucket = "house-media";

async function currentUser() {
  const db = await createServerSupabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  return user;
}

/**
 * A parent's background photo. The file is checked by what it is, not what it says it is, then redrawn as a WebP
 * no longer than 2400px with every bit of metadata (place, camera, time) left behind, and stored privately.
 */
export async function POST(request: Request) {
  if (!supabaseConfigured()) return NextResponse.json({ error: "unavailable" }, { status: 404 });
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: "unavailable" }, { status: 503 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("photo");
  if (!(file instanceof Blob)) return NextResponse.json({ error: "type" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "size" }, { status: 413 });

  const input = Buffer.from(await file.arrayBuffer());
  let output: Buffer;
  try {
    const meta = await sharp(input, { limitInputPixels: MAX_PIXELS }).metadata();
    if (!meta.format || !formats.has(meta.format)) return NextResponse.json({ error: "type" }, { status: 415 });
    output = await sharp(input, { limitInputPixels: MAX_PIXELS })
      .rotate()
      .resize({ width: SIDE, height: SIDE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer();
  } catch {
    return NextResponse.json({ error: "type" }, { status: 415 });
  }

  const path = `backgrounds/${user.id}/${crypto.randomUUID()}.webp`;
  const upload = await admin.storage.from(bucket).upload(path, output, { contentType: "image/webp", cacheControl: "31536000" });
  if (upload.error) return NextResponse.json({ error: "failed" }, { status: 500 });
  return NextResponse.json({ path });
}

/** Clears the parent's background photos after a replace or a remove: all but the saved one and the one just chosen. */
export async function DELETE(request: Request) {
  if (!supabaseConfigured()) return NextResponse.json({ error: "unavailable" }, { status: 404 });
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  const body = (await request.json().catch(() => null)) as { keep?: unknown } | null;
  const keep = new Set([typeof body?.keep === "string" ? body.keep : ""]);
  const { data: profile } = await admin.from("profiles").select("prefs").eq("id", user.id).maybeSingle();
  const inUse = readPrefs(profile?.prefs).look.background.photo?.path;
  if (inUse) keep.add(inUse);

  const folder = `backgrounds/${user.id}`;
  const { data } = await admin.storage.from(bucket).list(folder, { limit: 100 });
  const stale = (data ?? []).map((item) => `${folder}/${item.name}`).filter((path) => !keep.has(path));
  if (stale.length > 0) await admin.storage.from(bucket).remove(stale);
  return NextResponse.json({ removed: stale.length });
}
