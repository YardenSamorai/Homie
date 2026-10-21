"use client";

import { useEffect } from "react";
import { authApi } from "@/lib/auth/api";
import { useAuth, useAuthReady } from "@/lib/auth/session";
import { MEMBER_COLORS, useHousehold } from "@/lib/household-store";
import { supabaseConfigured } from "@/lib/supabase/env";
import { onReturn } from "@/lib/on-return";
import { signedUrls } from "@/lib/supabase/media";
import { loadHouseholdLists, watchHouseholdLists, watchHouseholdMembers, writesPending, writesSettled } from "@/lib/supabase/lists";

/** The signed-in parents of this household and their shared lists, kept live between both phones. */
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
    const userId = session.userId;
    const self = { id: userId, name: session.displayName, color: MEMBER_COLORS[0] };
    if (!session.householdId) {
      syncSelf(self);
      return;
    }
    const householdId = session.householdId;
    let alive = true;
    const loadRoster = () => {
      void authApi
        .household(householdId)
        .then(async (house) => {
          const paths = house.members.flatMap((member) => (member.avatarPath ? [member.avatarPath] : []));
          const urls = paths.length > 0 ? await signedUrls(paths).catch(() => ({}) as Record<string, string>) : {};
          if (!alive) return;
          const members = house.members.map((member, index) => ({
            id: member.id,
            name: member.name,
            color: MEMBER_COLORS[index] ?? MEMBER_COLORS[0],
            photoPath: member.avatarPath ?? null,
            photo: member.avatarPath ? (urls[member.avatarPath] ?? null) : null,
          }));
          setRoster(userId, members.length > 0 ? members : [self]);
          // The role on this phone dates from sign-in; the house is the authority.
          const role = house.members.find((member) => member.id === userId)?.role;
          if (role && role !== useAuth.getState().session?.role) useAuth.getState().patch({ role });
        })
        .catch((error: { status?: number }) => {
          if (!alive) return;
          // The admin removed this parent: the house no longer opens for them, so they start over at setup or join.
          if (error.status === 404 && supabaseConfigured()) {
            useAuth.getState().patch({ householdId: null, householdName: null, role: null });
            syncSelf(self);
            return;
          }
          if (useHousehold.getState().members.length === 0) syncSelf(self);
        });
    };
    loadRoster();
    const stopWatching = watchHouseholdMembers(householdId, loadRoster);
    const stopReturn = onReturn(loadRoster);
    return () => {
      alive = false;
      stopWatching();
      stopReturn();
    };
  }, [ready, session?.userId, session?.displayName, session?.householdId, syncSelf, setRoster]);

  useEffect(() => {
    if (!ready || !session?.householdId || !supabaseConfigured()) return;
    const householdId = session.householdId;
    let alive = true;
    let latest = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const load = async () => {
      const request = ++latest;
      await writesSettled();
      try {
        const lists = await loadHouseholdLists(householdId);
        if (!alive || request !== latest) return;
        // A change made while this was loading would be undone by the older copy; its own event reloads again.
        if (writesPending()) return;
        replaceLists(lists);
      } catch {
        // Offline or a dropped request: keep what's on screen; the next event or return reloads.
      }
    };
    // Several events arrive together (completing a repeating task writes two rows): one reload for all of them.
    const soon = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void load(), 150);
    };

    void load();
    const stopWatching = watchHouseholdLists(householdId, {
      onChange: soon,
      knowsShoppingItem: (id) => useHousehold.getState().shopping.some((item) => item.id === id),
    });
    const stopReturn = onReturn(soon);
    return () => {
      alive = false;
      clearTimeout(timer);
      stopWatching();
      stopReturn();
    };
  }, [ready, session?.householdId, replaceLists]);

  return null;
}
