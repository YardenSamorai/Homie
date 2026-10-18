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
  return `${toDayKey(now)}|${now.getHours()}`;
};

/** Current day and hour, read only in the browser (null during server render and hydration). */
export function useClock(): { today: DayKey; hour: number } | null {
  const value = useSyncExternalStore(subscribe, snapshot, () => null);
  if (!value) return null;
  const [today, hour] = value.split("|");
  return { today, hour: Number(hour) };
}
