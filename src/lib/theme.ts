"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useAuth } from "./auth/session";
import { defaultLook, pageColor, type Look } from "./look";
import { applyLook, cacheLook, cachedPhoto } from "./look-apply";
import { setNativeBackground } from "./native";
import { periodFor } from "./period";
import { usePrefs } from "./prefs-store";
import { backgroundLink } from "./supabase/media";

/** The signed-in parent's look, or the default until their own is known. */
export function useLook(): Look {
  const userId = useAuth((s) => s.session?.userId ?? null);
  return usePrefs((s) => (userId && s.owner === userId ? s.prefs.look : defaultLook));
}

/** Whether this person's own choices are on the device yet: until then the look drawn before paint stays. */
function useOwnLook() {
  const userId = useAuth((s) => s.session?.userId ?? null);
  const own = usePrefs((s) => Boolean(userId) && s.owner === userId);
  return { userId, own };
}

function subscribeDark(onChange: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

export function useSystemDark() {
  return useSyncExternalStore(subscribeDark, () => window.matchMedia("(prefers-color-scheme: dark)").matches, () => false);
}

function pageOf(pathname: string) {
  const rest = pathname.replace(/^\/(he|en)/, "");
  if (rest === "" || rest === "/") return "today";
  return rest.match(/^\/(tasks|shopping|calendar|settings)/)?.[1] ?? "other";
}

/** A signed link to the person's background photo, reused from the device while it's still good. */
function usePhotoLink(userId: string | null, look: Look) {
  const path = look.background.kind === "photo" ? (look.background.photo?.path ?? null) : null;
  const [link, setLink] = useState<{ path: string; url: string; until: number } | null>(null);
  // Only read in effects (useLookSync draws nothing itself), so the server and first client render agree.
  const cached = typeof window !== "undefined" && userId && path ? cachedPhoto(userId, path) : null;
  const hasCached = Boolean(cached);
  useEffect(() => {
    if (!userId || !path || hasCached) return;
    let live = true;
    void backgroundLink(path).then((fresh) => {
      if (live && fresh) setLink({ path, ...fresh });
    });
    return () => {
      live = false;
    };
  }, [userId, path, hasCached]);
  return cached ?? (path && link?.path === path ? link : null);
}

/** Names the screen on the page, since a background can cover Today only. Render it inside `<Suspense>`. */
export function PageMarker() {
  const pathname = usePathname();
  useEffect(() => {
    document.documentElement.dataset.page = pageOf(pathname);
  }, [pathname]);
  return null;
}

/**
 * Draws the signed-in parent's look on the page and keeps it for the next open. Also follows the part of the
 * day for the sky, and colors the status bar.
 */
export function useLookSync() {
  const { userId, own } = useOwnLook();
  const look = useLook();
  const dark = useSystemDark();
  const photo = usePhotoLink(userId, look);

  useEffect(() => {
    void usePrefs.persist.rehydrate();
  }, []);

  useEffect(() => {
    const tick = () => {
      document.documentElement.dataset.period = periodFor(new Date().getHours());
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!userId || !own) return;
    const waitingForPhoto = look.background.kind === "photo" && !photo;
    applyLook(look, waitingForPhoto ? undefined : (photo?.url ?? null));
    if (!waitingForPhoto) cacheLook(userId, look, photo);
  }, [userId, own, look, photo]);

  useEffect(() => {
    const isDark = look.mode === "dark" || (look.mode === "system" && dark);
    const color = pageColor(look, isDark);
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
      meta.setAttribute("content", color);
      meta.removeAttribute("media");
    });
    setNativeBackground(color);
  }, [look, dark]);
}
