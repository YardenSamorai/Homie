"use client";

import { defaultLook, lookTokens, type Look, type LookTokens } from "./look";
import { lookCacheKey } from "./theme-script";

const lookVars = ["--accent", "--accent-contrast", "--today", "--today-contrast", "--fill", "--sage-light", "--bg-x", "--bg-y", "--bg-zoom", "--bg-blur", "--bg-veil"];

/**
 * A look drawn on the page root. The text size zooms the body. `photoUrl` undefined leaves the photo already
 * drawn (from the device) in place while a fresh link loads.
 */
export function applyTokens(element: HTMLElement, tokens: LookTokens, photoUrl: string | null | undefined) {
  for (const [name, value] of Object.entries(tokens.attrs)) element.setAttribute(`data-${name}`, value);
  for (const name of lookVars) {
    if (name in tokens.vars) element.style.setProperty(name, tokens.vars[name]);
    else element.style.removeProperty(name);
  }
  if (photoUrl) element.style.setProperty("--bg-photo", `url("${photoUrl}")`);
  else if (photoUrl === null) element.style.removeProperty("--bg-photo");
  const zoomed = element === document.documentElement ? document.body : element;
  zoomed.style.zoom = tokens.zoom === 1 ? "" : String(tokens.zoom);
}

export function applyLook(look: Look, photoUrl: string | null | undefined) {
  const root = document.documentElement;
  delete root.dataset.tint;
  applyTokens(root, lookTokens(look), photoUrl);
}

type Cached = LookTokens & { uid: string; photo?: { path: string; url: string; until: number } };

function readCache(): Cached | null {
  try {
    const raw = localStorage.getItem(lookCacheKey);
    return raw ? (JSON.parse(raw) as Cached) : null;
  } catch {
    return null;
  }
}

/** Kept so the next open draws this person's look before anything loads (themeScript). */
export function cacheLook(uid: string, look: Look, photo: Cached["photo"] | null) {
  try {
    const cached: Cached = { uid, ...lookTokens(look), ...(photo ? { photo } : {}) };
    localStorage.setItem(lookCacheKey, JSON.stringify(cached));
  } catch {}
}

/** A signed link to this person's photo that's still good for a while, if the device has one. */
export function cachedPhoto(uid: string, path: string) {
  const cached = readCache();
  if (!cached || cached.uid !== uid || cached.photo?.path !== path) return null;
  return cached.photo.until > Date.now() + 60 * 60 * 1000 ? cached.photo : null;
}

/** Signing out: the device goes back to the default look, and nothing of this person's stays for the next one. */
export function forgetLook() {
  try {
    localStorage.removeItem(lookCacheKey);
  } catch {}
  applyLook(defaultLook, null);
}
