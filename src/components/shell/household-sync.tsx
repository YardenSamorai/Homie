"use client";

import { useEffect } from "react";
import { authApi } from "@/lib/auth/api";
import { useAuth, useAuthReady } from "@/lib/auth/session";
import { readableOn } from "@/lib/color";
import { MEMBER_COLORS, useHousehold } from "@/lib/household-store";
import { supabaseConfigured } from "@/lib/supabase/env";
import { onReturn } from "@/lib/on-return";
import { loadPrefs, usePrefs, usePrefsOf } from "@/lib/prefs-store";
import { avatarLinks } from "@/lib/supabase/media";
import { startAislePlacing } from "@/lib/aisle-placing";
import { loadAisleMemory, loadHouseholdLists, loadShoppingExtras, watchHouseholdLists, watchHouseholdMembers } from "@/lib/supabase/lists";
import { sending, startOutbox, withPending } from "@/lib/supabase/outbox";

/** The signed-in parents of this household and their shared lists, kept live between both phones. */
export function HouseholdSync() {
  const ready = useAuthReady();
  const session = useAuth((s) => s.session);
  const syncSelf = useHousehold((s) => s.syncSelf);
  const setRoster = useHousehold((s) => s.setRoster);
  const replaceLists = useHousehold((s) => s.replaceLists);

  useEffect(() => {
    void useHousehold.persist.rehydrate();
    void usePrefs.persist.rehydrate();
    return startOutbox();
  }, []);

  useEffect(() => {
    if (!ready || !session?.userId) return;
    const userId = session.userId;
    const load = () => void loadPrefs(userId).catch(() => {});
    load();
    // Choices changed on another device arrive when the app comes back.
    return onReturn(load);
  }, [ready, session?.userId]);

  // The colors this parent chose for the people in the house, in their own view only.
  const people = usePrefsOf(session?.userId, (prefs) => prefs.calendarColors.people);
  const members = useHousehold((s) => s.members);
  useEffect(() => {
    // A chosen color is darkened as needed so the white initials on it stay readable.
    const colorOf = (id: string, index: number) => (people[id] ? readableOn(people[id], ["#ffffff"], 3) : (MEMBER_COLORS[index] ?? MEMBER_COLORS[0]));
    const colored = members.map((member, index) => ({ ...member, color: colorOf(member.id, index) }));
    if (colored.some((member, index) => member.color !== members[index].color)) setRoster(useHousehold.getState().currentUserId, colored);
  }, [people, members, setRoster]);

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
          const urls = paths.length > 0 ? await avatarLinks(paths) : {};
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
      try {
        const lists = await loadHouseholdLists(householdId);
        if (!alive || request !== latest) return;
        // A save that finished while this was loading isn't in this copy yet; its own event reloads again.
        if (sending()) return soon();
        replaceLists(withPending(lists), householdId);
      } catch {
        // Offline or a dropped request: keep what's on screen; the next event or return reloads.
      }
    };
    // Several events arrive together (completing a repeating task writes two rows): one reload for all of them.
    const soon = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void load(), 150);
    };

    let latestExtras = 0;
    let extrasTimer: ReturnType<typeof setTimeout> | undefined;
    const loadExtras = async () => {
      const request = ++latestExtras;
      try {
        const extras = await loadShoppingExtras(householdId);
        if (alive && request === latestExtras) useHousehold.getState().replaceExtras(extras);
      } catch {
        // History and habits stay as they were on this phone.
      }
    };
    const extrasSoon = () => {
      clearTimeout(extrasTimer);
      extrasTimer = setTimeout(() => void loadExtras(), 200);
    };

    void load();
    void loadExtras();
    const stopWatching = watchHouseholdLists(householdId, {
      onChange: soon,
      onExtras: extrasSoon,
      knowsShoppingItem: (id) => useHousehold.getState().shopping.some((item) => item.id === id),
    });
    const stopReturn = onReturn(() => {
      soon();
      extrasSoon();
    });
    return () => {
      alive = false;
      clearTimeout(timer);
      clearTimeout(extrasTimer);
      stopWatching();
      stopReturn();
    };
  }, [ready, session?.householdId, replaceLists]);

  useEffect(() => {
    if (!ready || !session?.householdId || !supabaseConfigured()) return;
    let alive = true;
    void loadAisleMemory(session.householdId).then((memory) => {
      if (alive) useHousehold.getState().setAisleMemory(memory);
    });
    const stop = startAislePlacing();
    return () => {
      alive = false;
      stop();
    };
  }, [ready, session?.householdId]);

  return null;
}
