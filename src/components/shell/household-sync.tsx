"use client";

import { useEffect } from "react";
import { authApi } from "@/lib/auth/api";
import { useAuth, useAuthReady } from "@/lib/auth/session";
import { MEMBER_COLORS, useHousehold } from "@/lib/household-store";
import { supabaseConfigured } from "@/lib/supabase/env";
import { loadHouseholdLists, watchHouseholdLists } from "@/lib/supabase/lists";

/** The signed-in parents of this household. Lists start empty — no demo chores. */
export function HouseholdSync() {
  const ready = useAuthReady();
  const session = useAuth((s) => s.session);
  const syncSelf = useHousehold((s) => s.syncSelf);
  const setRoster = useHousehold((s) => s.setRoster);
  const replaceLists = useHousehold((s) => s.replaceLists);

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

  useEffect(() => {
    if (!ready || !session?.householdId || !supabaseConfigured()) return;
    const householdId = session.householdId;
    let alive = true;
    const load = () => {
      void loadHouseholdLists(householdId).then((lists) => {
        if (alive) replaceLists(lists);
      });
    };
    load();
    const stop = watchHouseholdLists(householdId, load);
    return () => {
      alive = false;
      stop();
    };
  }, [ready, session?.householdId, replaceLists]);

  return null;
}
