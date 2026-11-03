"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/session";
import { readLook, themeDefaults, type Look } from "@/lib/look";
import { onReturn } from "@/lib/on-return";
import { createBrowserSupabase } from "./browser";
import { supabaseConfigured } from "./env";

/** What a shared look may carry. The server strips anything else (share_look, 0014). */
export type OfferedLook = Pick<Look, "theme" | "accent" | "cards"> & { density?: Look["density"]; background: Pick<Look["background"], "kind" | "gradient"> | null };
export type LookShare = { id: string; from: string; offered: OfferedLook; createdAt: string };

export function offerOf(look: Look, withDensity: boolean): OfferedLook {
  return {
    theme: look.theme,
    accent: look.accent,
    cards: look.cards,
    background: look.background.kind === "photo" ? null : { kind: look.background.kind, gradient: look.background.gradient },
    ...(withDensity ? { density: look.density } : {}),
  };
}

/**
 * The receiver's own look with the offer laid over it. Their mode, type, size, bold, motion, drawings and any photo
 * stay theirs; a background left out (the sender's was a photo) falls back to the theme's.
 */
export function withOffer(mine: Look, offered: OfferedLook): Look {
  const background = offered.background ?? themeDefaults[offered.theme]?.background ?? themeDefaults.nature.background;
  return readLook({
    ...mine,
    theme: offered.theme,
    accent: offered.accent,
    cards: offered.cards,
    density: offered.density ?? mine.density,
    background: { ...mine.background, kind: background.kind, gradient: background.gradient, photo: null },
  });
}

export async function sendLook(partner: string, offered: OfferedLook) {
  if (!supabaseConfigured()) return false;
  const { error } = await createBrowserSupabase().rpc("share_look", { partner, offered });
  return !error;
}

type Row = { id: string; from_user: string; look: unknown; created_at: string };

export async function loadIncoming(userId: string): Promise<LookShare | null> {
  if (!supabaseConfigured()) return null;
  const { data } = await createBrowserSupabase()
    .from("theme_shares")
    .select("id, from_user, look, created_at")
    .eq("to_user", userId)
    .is("answered_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const row = data as Row | null;
  if (!row) return null;
  const look = readLook(row.look);
  const raw = (row.look ?? {}) as { background?: unknown; density?: unknown };
  return {
    id: row.id,
    from: row.from_user,
    createdAt: row.created_at,
    offered: {
      ...offerOf(look, typeof raw.density === "string"),
      background: raw.background ? { kind: look.background.kind, gradient: look.background.gradient } : null,
    },
  };
}

export async function answerShare(id: string, applied: boolean) {
  if (!supabaseConfigured()) return;
  await createBrowserSupabase().rpc("answer_look_share", { share: id, applied });
}

/** A look the other parent offered and this one hasn't answered yet, kept current while the app is open. */
export function useIncomingShare() {
  const userId = useAuth((s) => s.session?.userId ?? null);
  const [share, setShare] = useState<LookShare | null>(null);
  const reload = useCallback(() => {
    if (!userId) return;
    void loadIncoming(userId).then(setShare, () => {});
  }, [userId]);
  useEffect(() => {
    if (!userId || !supabaseConfigured()) return;
    reload();
    const stopWatching = watchShares(userId, reload);
    const stopReturn = onReturn(reload);
    return () => {
      stopWatching();
      stopReturn();
    };
  }, [userId, reload]);
  return { share, clear: () => setShare(null) };
}

export function watchShares(userId: string, onChange: () => void) {
  if (!supabaseConfigured()) return () => {};
  const db = createBrowserSupabase();
  const channel = db
    .channel(`look-shares-${userId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "theme_shares", filter: `to_user=eq.${userId}` }, onChange)
    .subscribe();
  return () => {
    void db.removeChannel(channel);
  };
}
