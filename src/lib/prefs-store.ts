"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import { lookFromDevice } from "./look";
import { changesBetween, defaultPrefs, readPrefs, storedLook, type Prefs, type PrefsChange } from "./prefs";
import { createBrowserSupabase } from "./supabase/browser";
import { supabaseConfigured } from "./supabase/env";
import { boldStorageKey, textStorageKey, themeStorageKey, tintStorageKey } from "./theme-script";

export type SaveResult = "saved" | "failed" | "offline";

type PrefsState = {
  /** The person these choices belong to. Anything kept on the device for someone else is never shown. */
  owner: string | null;
  prefs: Prefs;
  /** What the account last confirmed. A failed save goes back to it. */
  saved: Prefs;
  loaded: boolean;
  status: "idle" | "saving" | "failed";
  replace: (owner: string, prefs: Prefs) => void;
  /** Changes one part right away and saves it; on failure the switch goes back to what's saved. */
  update: <K extends keyof Prefs>(userId: string, key: K, value: Prefs[K]) => Promise<SaveResult>;
  /** Saves a whole new set of choices (only what differs is sent). The caller keeps its own draft on failure. */
  commit: (userId: string, next: Prefs) => Promise<SaveResult>;
  forget: () => void;
};

let queue: Promise<unknown> = Promise.resolve();

async function send(changes: PrefsChange[]): Promise<{ prefs: Prefs } | SaveResult> {
  try {
    const response = await fetch("/api/prefs", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ changes }),
    });
    if (!response.ok) return "failed";
    const body = (await response.json()) as { prefs?: unknown };
    return { prefs: readPrefs(body.prefs) };
  } catch {
    return "offline";
  }
}

/** Kept on the device too, so the first screen shows the last saved choices before the account answers. */
export const usePrefs = create<PrefsState>()(
  persist(
    (set, get) => ({
      owner: null,
      prefs: defaultPrefs,
      saved: defaultPrefs,
      loaded: false,
      status: "idle",
      replace: (owner, prefs) => set({ owner, prefs, saved: prefs, loaded: true }),
      update: (userId, key, value) => get().commit(userId, { ...get().prefs, [key]: value }),
      commit: (userId, next) => {
        const clean = readPrefs(next);
        const changes = changesBetween(get().prefs, clean);
        if (changes.length === 0) return Promise.resolve("saved" as const);
        set({ prefs: clean, owner: userId || get().owner });
        if (!supabaseConfigured() || !userId) {
          set({ saved: clean });
          return Promise.resolve("saved" as const);
        }
        set({ status: "saving" });
        const run = queue.then(async (): Promise<SaveResult> => {
          const answer = await send(changes);
          if (get().owner !== userId) return "failed";
          if (typeof answer === "string") {
            set({ prefs: get().saved, status: "failed" });
            return answer;
          }
          set({ prefs: answer.prefs, saved: answer.prefs, status: "idle" });
          return "saved";
        });
        queue = run.catch(() => {});
        return run;
      },
      forget: () => set({ owner: null, prefs: defaultPrefs, saved: defaultPrefs, loaded: false, status: "idle" }),
    }),
    {
      name: "homie-prefs",
      skipHydration: true,
      partialize: ({ owner, prefs, saved }) => ({ owner, prefs, saved }),
      merge: (persisted, current) => {
        const stored = (persisted ?? {}) as Partial<PrefsState>;
        return { ...current, owner: stored.owner ?? null, prefs: readPrefs(stored.prefs), saved: readPrefs(stored.saved ?? stored.prefs) };
      },
    },
  ),
);

/** This person's choices, or the defaults until theirs are known: never another account's left on the device. */
export function usePrefsOf<T>(userId: string | null | undefined, select: (prefs: Prefs) => T): T {
  return usePrefs(useShallow((s) => select(userId && s.owner === userId ? s.prefs : defaultPrefs)));
}

function deviceChoices() {
  try {
    const read = (key: string) => localStorage.getItem(key);
    const found = { theme: read(themeStorageKey), text: read(textStorageKey), tint: read(tintStorageKey), bold: read(boldStorageKey) };
    return Object.values(found).some((value) => value !== null) ? found : null;
  } catch {
    return null;
  }
}

function forgetDeviceChoices() {
  try {
    for (const key of [themeStorageKey, textStorageKey, tintStorageKey, boldStorageKey]) localStorage.removeItem(key);
  } catch {}
}

/**
 * Reads the account's choices. The first time an account without a saved look opens on a device where appearance
 * was chosen before looks moved into the account, those choices become its look, so nothing set earlier is lost.
 */
export async function loadPrefs(userId: string) {
  const store = usePrefs.getState();
  if (store.owner !== userId) store.forget();
  if (!supabaseConfigured()) {
    if (usePrefs.getState().owner !== userId) {
      const device = deviceChoices();
      usePrefs.getState().replace(userId, device ? { ...defaultPrefs, look: lookFromDevice(device) } : defaultPrefs);
    }
    return;
  }
  const { data, error } = await createBrowserSupabase().from("profiles").select("prefs").eq("id", userId).maybeSingle();
  if (error || !data) return;
  // A save in flight answers with the account's newest copy itself.
  if (usePrefs.getState().status === "saving") return;
  const prefs = readPrefs(data.prefs);
  usePrefs.getState().replace(userId, prefs);
  const device = storedLook(data.prefs) ? null : deviceChoices();
  if (!device) {
    if (storedLook(data.prefs)) forgetDeviceChoices();
    return;
  }
  const result = await usePrefs.getState().commit(userId, { ...prefs, look: lookFromDevice(device) });
  if (result === "saved") forgetDeviceChoices();
}
