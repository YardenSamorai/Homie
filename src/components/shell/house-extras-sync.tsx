"use client";

import { useEffect } from "react";
import { calendarRange, mergeCopies } from "@/lib/agenda";
import { useAuth, useAuthReady } from "@/lib/auth/session";
import { useCalendarItems, useHouseNote } from "@/lib/house-stores";
import { useHousehold } from "@/lib/household-store";
import { onReturn } from "@/lib/on-return";
import { supabaseConfigured } from "@/lib/supabase/env";
import { loadHouseCalendar, loadNote, watchNote } from "@/lib/supabase/house-extras";
import { toDayKey } from "@/lib/dates";

const REFRESH_MS = 5 * 60_000;
/** Ask the server to read calendars again when what's here is older than this (it skips what's fresh anyway). */
const STALE_MS = 10 * 60_000;

/**
 * The pinned note and the house's connected calendars, for Today and the calendar. Mounted once in the app layout.
 * Both are read for one person in one house; switching either drops what was kept for the last.
 */
export function HouseExtrasSync() {
  const ready = useAuthReady();
  const userId = useAuth((s) => s.session?.userId ?? null);
  const householdId = useAuth((s) => s.session?.householdId ?? null);

  useEffect(() => {
    void useHouseNote.persist.rehydrate();
    void useCalendarItems.persist.rehydrate();
  }, []);

  useEffect(() => {
    if (!ready) return;
    const owner = userId && householdId ? `${userId}:${householdId}` : null;
    if (useHouseNote.getState().owner !== owner) useHouseNote.getState().clear();
    if (useCalendarItems.getState().owner !== owner) useCalendarItems.getState().clear();
    if (owner && userId && !supabaseConfigured() && process.env.NODE_ENV === "development") return showDemoCalendars(owner, userId);
    if (!owner || !userId || !householdId || !supabaseConfigured()) return;

    let alive = true;
    const readNote = () => {
      loadNote(householdId)
        .then((note) => alive && useHouseNote.getState().set(owner, note))
        .catch(() => {});
    };
    const readCalendar = async () => {
      const store = useCalendarItems.getState();
      if (store.status === "loading") return;
      store.setStatus("loading");
      const { from, to } = calendarRange(toDayKey(new Date()));
      try {
        const rows = await loadHouseCalendar(from, to);
        if (alive) useCalendarItems.getState().set(owner, mergeCopies(rows, userId));
      } catch {
        if (alive) useCalendarItems.getState().setStatus("failed");
      }
    };
    const refreshSources = () => {
      const loadedAt = useCalendarItems.getState().loadedAt;
      if (loadedAt && Date.now() - loadedAt < STALE_MS) return;
      void fetch("/api/calendars", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "sync", scope: "house" }),
      })
        .then((response) => (response.ok ? readCalendar() : undefined))
        .catch(() => {});
    };
    const everything = () => {
      void readCalendar().then(refreshSources);
    };

    everything();
    const stopNote = watchNote(householdId, readNote);
    const stopReturn = onReturn(everything);
    const timer = window.setInterval(everything, REFRESH_MS);
    return () => {
      alive = false;
      stopNote();
      stopReturn();
      window.clearInterval(timer);
    };
  }, [ready, userId, householdId]);

  return null;
}

/** Development demo only: ?demoCalendars=1 fills the calendar with sample rows for this tab (see demo-rows.ts). */
function showDemoCalendars(owner: string, userId: string) {
  const asked = new URLSearchParams(window.location.search).get("demoCalendars");
  if (asked === "1") sessionStorage.setItem("homie-demo-calendars", "1");
  if (asked === "0") sessionStorage.removeItem("homie-demo-calendars");
  if (sessionStorage.getItem("homie-demo-calendars") !== "1") return;
  let alive = true;
  const apply = () =>
    void import("@/lib/calendars/demo-rows").then(({ demoCalendarRows }) => {
      if (!alive) return;
      const partner = useHousehold.getState().members.find((member) => member.id !== userId)?.id ?? null;
      useCalendarItems.getState().set(owner, mergeCopies(demoCalendarRows(toDayKey(new Date()), userId, partner), userId));
    });
  apply();
  const stop = useHousehold.subscribe((state, before) => state.members !== before.members && apply());
  return () => {
    alive = false;
    stop();
  };
}

/** After a change in Settings (a calendar chosen, a sync, a disconnect), Today reads again right away. */
export async function reloadHouseCalendar(userId: string, householdId: string) {
  if (!supabaseConfigured()) return;
  const { from, to } = calendarRange(toDayKey(new Date()));
  const rows = await loadHouseCalendar(from, to);
  useCalendarItems.getState().set(`${userId}:${householdId}`, mergeCopies(rows, userId));
}
