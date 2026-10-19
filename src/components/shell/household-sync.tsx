"use client";

import { useEffect } from "react";
import { useAuth, useAuthReady } from "@/lib/auth/session";
import { MEMBER_COLORS, useHousehold } from "@/lib/household-store";

/** The signed-in parent is the household. Lists start empty — no demo chores. */
export function HouseholdSync() {
  const ready = useAuthReady();
  const session = useAuth((s) => s.session);
  const syncSelf = useHousehold((s) => s.syncSelf);

  useEffect(() => {
    if (!ready) return;
    if (!session?.userId || !session.displayName) {
      syncSelf(null);
      return;
    }
    syncSelf({
      id: session.userId,
      name: session.displayName,
      color: MEMBER_COLORS[0],
    });
  }, [ready, session?.userId, session?.displayName, syncSelf]);

  return null;
}
