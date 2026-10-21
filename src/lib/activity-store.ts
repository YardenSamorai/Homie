"use client";

import { create } from "zustand";
import type { ActivityItem } from "./activity";
import { markActivitySeen } from "./supabase/activity";

type ActivityState = {
  items: ActivityItem[];
  /** When this parent last opened the bell; everything the other parent did after it is new. */
  seenAt: string | null;
  /** seenAt as it was when the sheet opened, so this visit still marks what's new. */
  seenBefore: string | null;
  open: boolean;
  replace: (items: ActivityItem[], seenAt: string | null) => void;
  add: (item: ActivityItem) => void;
  /** Opens the sheet and marks everything as seen, here and on the other devices. */
  show: (selfId: string) => void;
  hide: () => void;
  clear: () => void;
};

/** Postgres and the browser write timestamps differently ("+00:00" vs "Z"), so compare instants, not strings. */
const time = (iso: string | null) => (iso ? Date.parse(iso) : 0);

export const useActivity = create<ActivityState>()((set, get) => ({
  items: [],
  seenAt: null,
  seenBefore: null,
  open: false,
  replace: (items, seenAt) => set((state) => ({ items, seenAt: time(state.seenAt) > time(seenAt) ? state.seenAt : seenAt })),
  add: (item) => set(({ items }) => (items.some((known) => known.id === item.id) ? {} : { items: [item, ...items].slice(0, 50) })),
  show: (selfId) => {
    const at = new Date().toISOString();
    set({ open: true, seenBefore: get().seenAt, seenAt: at });
    if (selfId) void markActivitySeen(selfId, at);
  },
  hide: () => set({ open: false }),
  clear: () => set({ items: [], seenAt: null, seenBefore: null, open: false }),
}));

export function isUnread(item: ActivityItem, seenAt: string | null, selfId: string) {
  return item.actorId !== selfId && time(item.createdAt) > time(seenAt);
}

export function unreadCount(items: ActivityItem[], seenAt: string | null, selfId: string) {
  return items.filter((item) => isUnread(item, seenAt, selfId)).length;
}
