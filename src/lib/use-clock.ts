"use client";

import { useSyncExternalStore } from "react";
import { toDayKey, type DayKey } from "./dates";

const subscribe = (onChange: () => void) => {
  const id = setInterval(onChange, 30_000);
  document.addEventListener("visibilitychange", onChange);
  return () => {
    clearInterval(id);
    document.removeEventListener("visibilitychange", onChange);
  };
};

const snapshot = () => {
  const now = new Date();
  // Development only: ?sky=HH:MM pins the greeting along with the sky.
  const pinned =
    process.env.NODE_ENV === "development" ? /^(\d{1,2}):\d{2}$/.exec(new URLSearchParams(location.search).get("sky") ?? "") : null;
  return `${toDayKey(now)}|${pinned ? Number(pinned[1]) : now.getHours()}`;
};

/** Current day and hour, read only in the browser (null during server render and hydration). */
export function useClock(): { today: DayKey; hour: number } | null {
  const value = useSyncExternalStore(subscribe, snapshot, () => null);
  if (!value) return null;
  const [today, hour] = value.split("|");
  return { today, hour: Number(hour) };
}

const minuteSnapshot = () => {
  const now = new Date();
  return `${toDayKey(now)}|${now.getHours() * 60 + now.getMinutes()}`;
};

/** The day and the minute of it, for what has already ended ("next event"); re-renders once a minute. */
export function useMinuteClock(): { today: DayKey; minutes: number } | null {
  const value = useSyncExternalStore(subscribe, minuteSnapshot, () => null);
  if (!value) return null;
  const [today, minutes] = value.split("|");
  return { today, minutes: Number(minutes) };
}
