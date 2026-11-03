"use client";

import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { Card } from "@/components/ui/card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
import { useAuth } from "@/lib/auth/session";
import { weekDays, type Prefs } from "@/lib/prefs";
import { usePrefs, usePrefsOf } from "@/lib/prefs-store";
import { minutesOf } from "@/lib/routine";
import { useMinuteClock } from "@/lib/use-clock";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { supabaseConfigured } from "@/lib/supabase/env";

const row = "flex min-h-12 items-center justify-between gap-3 px-4 py-row";
const hint = "px-4 pb-3 pt-1 text-[13px] leading-snug text-label-secondary";
const HOUSE_ZONE = "Asia/Jerusalem";

/** The house's own zone, which the morning summary used before each parent could choose one. */
function useHouseZone() {
  const householdId = useAuth((s) => s.session?.householdId ?? null);
  const [zone, setZone] = useState(HOUSE_ZONE);
  useEffect(() => {
    if (!householdId || !supabaseConfigured()) return;
    let live = true;
    void createBrowserSupabase()
      .from("households")
      .select("timezone")
      .eq("id", householdId)
      .maybeSingle()
      .then(({ data }) => {
        if (live && typeof data?.timezone === "string") setZone(data.timezone);
      });
    return () => {
      live = false;
    };
  }, [householdId]);
  return zone;
}

function Days({ label, days, onChange }: { label: string; days: number[]; onChange: (days: number[]) => void }) {
  const { dict } = useI18n();
  const copy = dict.routine;
  return (
    <div role="group" aria-label={label} className="flex justify-between gap-1.5">
      {weekDays.map((day) => {
        const on = days.includes(day);
        return (
          <button
            key={day}
            type="button"
            aria-pressed={on}
            aria-label={copy.daysLong[day]}
            onClick={() => onChange(on ? days.filter((d) => d !== day) : [...days, day].sort())}
            className={`flex size-11 items-center justify-center rounded-full text-[15px] font-semibold transition-[background-color,color,scale] duration-150 ease-out active:scale-[0.97] ${
              on ? "bg-accent text-accent-contrast" : "bg-fill text-label-secondary"
            }`}
          >
            {copy.days[day]}
          </button>
        );
      })}
    </div>
  );
}

function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <input
      type="time"
      step={900}
      value={value}
      aria-label={label}
      onChange={(event) => {
        if (/^\d{2}:\d{2}$/.test(event.target.value)) onChange(event.target.value);
      }}
      className="h-10 min-w-[6.5rem] rounded-[10px] bg-fill px-3 text-center text-[17px] tabular-nums text-label outline-none"
    />
  );
}

function daysLine(days: number[], copy: { everyDay: string; noDays: string }) {
  if (days.length === 7) return copy.everyDay;
  if (days.length === 0) return copy.noDays;
  return null;
}

const noSubscribe = () => () => {};
const noZones: string[] = [];
let zoneList: string[] | null = null;

function deviceZoneOf() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || HOUSE_ZONE;
  } catch {
    return HOUSE_ZONE;
  }
}

function allZones() {
  if (!zoneList) {
    try {
      zoneList = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.("timeZone") ?? [];
    } catch {
      zoneList = [];
    }
  }
  return zoneList;
}

/** When the morning summary comes, in which zone, the quiet hours, and whether pushes come one by one or gathered. */
export function RoutineCard() {
  const { locale, dict } = useI18n();
  const copy = dict.routine;
  const userId = useAuth((s) => s.session?.userId) ?? "";
  const prefs = usePrefsOf(userId, (p) => p);
  const update = usePrefs((s) => s.update);
  const [failed, setFailed] = useState(false);
  const houseZone = useHouseZone();
  const deviceZone = useSyncExternalStore(noSubscribe, deviceZoneOf, () => HOUSE_ZONE);
  const zones = useSyncExternalStore(noSubscribe, allZones, () => noZones);
  const zoneId = useId();
  const zone = prefs.timezone ?? houseZone;
  const clock = useMinuteClock();
  const now = clock ? new Intl.DateTimeFormat(locale, { timeZone: zone, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date()) : null;

  const save = <K extends keyof Prefs>(key: K, value: Prefs[K]) => {
    setFailed(false);
    void update(userId, key, value).then((result) => setFailed(result !== "saved"));
  };
  const overnight = minutesOf(prefs.quiet.end) <= minutesOf(prefs.quiet.start);

  return (
    <>
      <Card title={copy.morningTitle}>
        <div className={row}>
          <span className="text-[17px]">{copy.morningOn}</span>
          <Switch checked={prefs.morning.on} label={copy.morningOn} onChange={(on) => save("morning", { ...prefs.morning, on })} />
        </div>
        {prefs.morning.on && (
          <>
            <div className={`${row} border-t border-separator`}>
              <span className="text-[17px]">{copy.morningTime}</span>
              <TimeField label={copy.morningTime} value={prefs.morning.time} onChange={(time) => save("morning", { ...prefs.morning, time })} />
            </div>
            <div className="flex flex-col gap-2.5 border-t border-separator px-4 py-3">
              <span className="flex items-baseline justify-between gap-3 text-[17px]">
                {copy.morningDays}
                <span className="text-[13px] text-label-secondary">{daysLine(prefs.morning.days, copy)}</span>
              </span>
              <Days label={copy.morningDays} days={prefs.morning.days} onChange={(days) => save("morning", { ...prefs.morning, days })} />
            </div>
          </>
        )}
        <p className={hint}>
          {dict.prefs.morningHint} {copy.timeStep}
        </p>
      </Card>

      <Card title={copy.quietTitle}>
        <div className={row}>
          <span className="text-[17px]">{copy.quietOn}</span>
          <Switch checked={prefs.quiet.on} label={copy.quietOn} onChange={(on) => save("quiet", { ...prefs.quiet, on })} />
        </div>
        {prefs.quiet.on && (
          <>
            <div className={`${row} border-t border-separator`}>
              <span className="text-[17px]">{copy.quietFrom}</span>
              <TimeField label={copy.quietFrom} value={prefs.quiet.start} onChange={(start) => save("quiet", { ...prefs.quiet, start })} />
            </div>
            <div className={`${row} border-t border-separator`}>
              <span className="flex flex-col">
                <span className="text-[17px]">{copy.quietTo}</span>
                {overnight && <span className="text-[13px] text-label-secondary">{format(copy.quietNextDay, { time: prefs.quiet.end })}</span>}
              </span>
              <TimeField label={copy.quietTo} value={prefs.quiet.end} onChange={(end) => save("quiet", { ...prefs.quiet, end })} />
            </div>
            <div className="flex flex-col gap-2.5 border-t border-separator px-4 py-3">
              <span className="flex items-baseline justify-between gap-3 text-[17px]">
                {copy.quietDays}
                <span className="text-[13px] text-label-secondary">{daysLine(prefs.quiet.days, copy)}</span>
              </span>
              <Days label={copy.quietDays} days={prefs.quiet.days} onChange={(days) => save("quiet", { ...prefs.quiet, days })} />
            </div>
          </>
        )}
        <p className={hint}>{copy.quietHint}</p>
      </Card>

      <Card title={copy.deliveryTitle}>
        <div className="p-3">
          <SegmentedControl
            label={copy.deliveryTitle}
            value={prefs.delivery}
            onChange={(delivery) => save("delivery", delivery)}
            options={(["instant", "digest"] as const).map((value) => ({ value, label: copy.deliveries[value] }))}
          />
        </div>
        <p className={hint}>{copy.deliveryHints[prefs.delivery]}</p>
      </Card>

      <Card title={copy.zoneTitle}>
        <div className="flex flex-col gap-2 px-4 py-3">
          <label htmlFor={zoneId} className="text-[17px]">
            {copy.zoneTitle}
          </label>
          <select
            id={zoneId}
            value={prefs.timezone ?? ""}
            onChange={(event) => save("timezone", event.target.value || null)}
            className="h-11 w-full rounded-[10px] bg-fill px-3 text-[17px] text-label outline-none"
          >
            <option value="">{format(copy.zoneHouse, { zone: houseZone })}</option>
            {(deviceZone !== houseZone || prefs.timezone === deviceZone) && <option value={deviceZone}>{format(copy.zoneDevice, { zone: deviceZone })}</option>}
            {zones
              .filter((name) => name !== deviceZone && (name !== houseZone || name === prefs.timezone))
              .map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
          </select>
          <p className="text-[13px] text-label-secondary">
            <bdi>{now ? format(copy.zoneNow, { time: now }) : "\u00a0"}</bdi>
          </p>
        </div>
        <p className={hint}>{copy.zoneHint}</p>
      </Card>
      {failed && (
        <p role="alert" className="-mt-5 px-1 text-[13px] text-danger">
          {copy.failed}
        </p>
      )}
    </>
  );
}
