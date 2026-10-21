/**
 * Profile photos live in the public "avatars" bucket at <user>/<random>.jpg: a fixed address the phone
 * caches, so a photo shows the moment a screen opens. Photos from before 0008 sit in the private
 * house-media bucket under "avatars/…" and still need a signed link (null here).
 */
export const legacyAvatar = (path: string) => path.startsWith("avatars/");

export function avatarUrl(path: string | null | undefined) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!path || !base || legacyAvatar(path)) return null;
  return `${base}/storage/v1/object/public/avatars/${path}`;
}
