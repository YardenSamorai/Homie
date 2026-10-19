"use client";

import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthSession } from "./types";

type AuthState = {
  session: AuthSession | null;
  setSession: (session: AuthSession | null) => void;
  patch: (partial: Partial<AuthSession>) => void;
  signOut: () => void;
};

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      session: null,
      setSession: (session) => set({ session }),
      patch: (partial) => {
        const current = get().session;
        if (!current) return;
        set({ session: { ...current, ...partial } });
      },
      signOut: () => set({ session: null }),
    }),
    { name: "homie-auth" },
  ),
);

/** Persist hydrates after paint; wait so invite routing does not flicker. */
export function useAuthReady() {
  return useSyncExternalStore(
    (onChange) => useAuth.persist.onFinishHydration(onChange),
    () => useAuth.persist.hasHydrated(),
    () => false,
  );
}
