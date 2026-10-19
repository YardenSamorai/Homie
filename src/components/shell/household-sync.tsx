"use client";

import { useEffect } from "react";
import { authApi } from "@/lib/auth/api";
import { useAuth, useAuthReady } from "@/lib/auth/session";
import { MEMBER_COLORS, useHousehold } from "@/lib/household-store";

/** The signed-in parents of this household. Lists start empty — no demo chores. */
export function HouseholdSync() {
  const ready = useAuthReady();
  const session = useAuth((s) => s.session);
  const syncSelf = useHousehold((s) => s.syncSelf);
  const setRoster = useHousehold((s) => s.setRoster);

  useEffect(() => {
    if (!ready) return;
    if (!session?.userId || !session.displayName) {
      syncSelf(null);
      return;
    }
    const self = {
      id: session.userId,
      name: session.displayName,
      color: MEMBER_COLORS[0],
    };
    if (!session.householdId) {
      syncSelf(self);
      return;
    }
    let alive = true;
    void authApi
      .household(session.householdId)
      .then((house) => {
        if (!alive) return;
        const members = house.members.map((member, index) => ({
          id: member.id,
          name: member.name,
          color: MEMBER_COLORS[index] ?? MEMBER_COLORS[0],
        }));
        setRoster(session.userId, members.length > 0 ? members : [self]);
      })
      .catch(() => {
        if (alive) syncSelf(self);
      });
    return () => {
      alive = false;
    };
  }, [ready, session?.userId, session?.displayName, session?.householdId, syncSelf, setRoster]);

  return null;
}
