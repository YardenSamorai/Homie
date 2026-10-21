"use client";

import { storyWithoutCaption } from "@/lib/activity";
import { avatarUrl, legacyAvatar } from "@/lib/avatar-url";
import { announce } from "./activity";
import { createBrowserSupabase } from "./browser";
import { supabaseConfigured } from "./env";

const bucket = "house-media";

export type Story = { id: string; authorId: string; path: string; caption: string | null; createdAt: string; expiresAt: string };
export type StoryView = { storyId: string; viewerId: string; viewedAt: string };

type StoryRow = { id: string; author_id: string; path: string; caption: string | null; created_at: string; expires_at: string };
type ViewRow = { story_id: string; viewer_id: string; viewed_at: string };

const toStory = (row: StoryRow): Story => ({
  id: row.id,
  authorId: row.author_id,
  path: row.path,
  caption: row.caption,
  createdAt: row.created_at,
  expiresAt: row.expires_at,
});

/**
 * A phone photo is 3–12 MB; this redraws it as a JPEG no longer than `side` on its long edge
 * (or a centered square, for avatars). The browser applies the photo's EXIF rotation when decoding.
 */
export async function compressImage(file: Blob, { side, square = false }: { side: number; square?: boolean }) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    const { naturalWidth: w, naturalHeight: h } = image;
    const crop = square ? Math.min(w, h) : 0;
    const sw = square ? crop : w;
    const sh = square ? crop : h;
    const scale = Math.min(1, side / Math.max(sw, sh));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(sw * scale);
    canvas.height = Math.round(sh * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("canvas");
    context.drawImage(image, square ? (w - crop) / 2 : 0, square ? (h - crop) / 2 : 0, sw, sh, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!blob) throw new Error("encode");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const signed = new Map<string, { url: string; until: number }>();

/** Short-lived links to private photos, reused until a few minutes before they expire. */
export async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  const now = Date.now();
  const missing = [...new Set(paths)].filter((path) => (signed.get(path)?.until ?? 0) < now + 5 * 60_000);
  if (missing.length > 0 && supabaseConfigured()) {
    const { data } = await createBrowserSupabase().storage.from(bucket).createSignedUrls(missing, 3600);
    for (const item of data ?? []) {
      if (item.path && item.signedUrl) signed.set(item.path, { url: item.signedUrl, until: now + 3600_000 });
    }
  }
  return Object.fromEntries(paths.flatMap((path) => (signed.has(path) ? [[path, signed.get(path)!.url]] : [])));
}

export async function loadStories() {
  const db = createBrowserSupabase();
  const [stories, views] = await Promise.all([
    db.from("stories").select("id, author_id, path, caption, created_at, expires_at").gt("expires_at", new Date().toISOString()).order("created_at"),
    db.from("story_views").select("story_id, viewer_id, viewed_at"),
  ]);
  if (stories.error) throw stories.error;
  return {
    stories: (stories.data as StoryRow[]).map(toStory),
    views: ((views.data ?? []) as ViewRow[]).map((row): StoryView => ({ storyId: row.story_id, viewerId: row.viewer_id, viewedAt: row.viewed_at })),
  };
}

export function watchStories(householdId: string, onChange: () => void) {
  if (!supabaseConfigured()) return () => {};
  const db = createBrowserSupabase();
  const channel = db
    .channel(`stories-${householdId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "stories", filter: `household_id=eq.${householdId}` }, onChange)
    // story_views has no household column to filter on; row security only lets this house's views through.
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "story_views" }, onChange)
    .subscribe((status) => {
      if (status === "SUBSCRIBED") onChange();
    });
  return () => {
    void db.removeChannel(channel);
  };
}

export async function postStory({ householdId, userId, photo, caption }: { householdId: string; userId: string; photo: Blob; caption: string }) {
  const db = createBrowserSupabase();
  const path = `stories/${householdId}/${userId}/${crypto.randomUUID()}.jpg`;
  const upload = await db.storage.from(bucket).upload(path, photo, { contentType: "image/jpeg", cacheControl: "86400" });
  if (upload.error) throw upload.error;
  const clean = caption.trim().slice(0, 120);
  const { data, error } = await db
    .from("stories")
    .insert({ household_id: householdId, author_id: userId, path, caption: clean || null })
    .select("id, author_id, path, caption, created_at, expires_at")
    .single();
  if (error || !data) {
    await db.storage.from(bucket).remove([path]);
    throw error ?? new Error("insert");
  }
  announce("story_added", data.id, clean || storyWithoutCaption);
  return toStory(data as StoryRow);
}

export async function deleteStory(story: Story) {
  const db = createBrowserSupabase();
  await db.from("stories").delete().eq("id", story.id);
  await db.storage.from(bucket).remove([story.path]);
}

/** Photos past their 24 hours: the author's phone clears its own, rows and files. */
export async function clearExpiredStories(userId: string) {
  const db = createBrowserSupabase();
  const { data } = await db.from("stories").select("id, path").eq("author_id", userId).lte("expires_at", new Date().toISOString());
  if (!data?.length) return;
  await db.storage.from(bucket).remove(data.map((row) => row.path as string));
  await db.from("stories").delete().in("id", data.map((row) => row.id as string));
}

export async function markStorySeen(storyId: string, viewerId: string) {
  await createBrowserSupabase().from("story_views").upsert({ story_id: storyId, viewer_id: viewerId }, { ignoreDuplicates: true });
}

/** An old photo leaves whichever bucket it was in: the private one before 0008, the public one since. */
async function removeAvatarFile(db: ReturnType<typeof createBrowserSupabase>, path: string | null) {
  if (!path) return;
  if (legacyAvatar(path)) await db.storage.from(bucket).remove([path]);
  else await db.storage.from("avatars").remove([path]);
}

/** Replaces this parent's photo with a new file (a new name, so every phone's cache sees it at once). Returns the path. */
export async function saveAvatar(userId: string, photo: Blob, previous: string | null) {
  const db = createBrowserSupabase();
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const upload = await db.storage.from("avatars").upload(path, photo, { contentType: "image/jpeg", cacheControl: "31536000" });
  if (upload.error) throw upload.error;
  const { error } = await db.from("profiles").update({ avatar_path: path }).eq("id", userId);
  if (error) {
    await db.storage.from("avatars").remove([path]);
    throw error;
  }
  await removeAvatarFile(db, previous);
  return path;
}

export async function removeAvatar(userId: string, previous: string | null) {
  const db = createBrowserSupabase();
  const { error } = await db.from("profiles").update({ avatar_path: null }).eq("id", userId);
  if (error) throw error;
  await removeAvatarFile(db, previous);
}

/** Links for the people's photos: fixed public ones, and signed ones only for photos from before 0008. */
export async function avatarLinks(paths: string[]) {
  const legacy = paths.filter(legacyAvatar);
  const signedLinks = legacy.length > 0 ? await signedUrls(legacy).catch(() => ({}) as Record<string, string>) : {};
  return Object.fromEntries(paths.map((path) => [path, avatarUrl(path) ?? signedLinks[path] ?? null])) as Record<string, string | null>;
}
