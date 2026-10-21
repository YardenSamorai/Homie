"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { defaultPrefs, readPrefs, type Prefs } from "./prefs";
import { createBrowserSupabase } from "./supabase/browser";
import { supabaseConfigured } from "./supabase/env";

type PrefsState = {
  prefs: Prefs;
  replace: (prefs: Prefs) => void;
  /** Changes one part right away and saves the whole set to the profile. */
  update: <K extends keyof Prefs>(userId: string, key: K, value: Prefs[K]) => void;
};

/** Kept on the phone too, so the switches show the last saved choice before the profile loads. */
export const usePrefs = create<PrefsState>()(
  persist(
    (set, get) => ({
      prefs: defaultPrefs,
      replace: (prefs) => set({ prefs }),
      update: (userId, key, value) => {
        const prefs = { ...get().prefs, [key]: value };
        set({ prefs });
        if (!supabaseConfigured() || !userId) return;
        void createBrowserSupabase().from("profiles").update({ prefs }).eq("id", userId);
      },
    }),
    { name: "homie-prefs", skipHydration: true },
  ),
);

export async function loadPrefs(userId: string) {
  if (!supabaseConfigured()) return;
  const { data, error } = await createBrowserSupabase().from("profiles").select("prefs").eq("id", userId).maybeSingle();
  if (!error && data) usePrefs.getState().replace(readPrefs(data.prefs));
}
