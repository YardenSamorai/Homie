"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
import { useAuth } from "@/lib/auth/session";
import { startingColor } from "@/lib/calendar-colors";
import { normalizeHex } from "@/lib/color";
import { firstName } from "@/lib/day-story";
import { useCalendarItems } from "@/lib/house-stores";
import { useHousehold } from "@/lib/household-store";
import type { CalendarColors } from "@/lib/prefs";
import { usePrefs, usePrefsOf } from "@/lib/prefs-store";

/** A color picker that saves once the parent stops dragging through colors, not on every step. */
function ColorPick({ label, color, value, onPick, onReset, resetLabel }: { label: string; color: string; value: string; onPick: (hex: string) => void; onReset: (() => void) | null; resetLabel: string }) {
  const [picking, setPicking] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const pick = (hex: string) => {
    setPicking(hex);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      onPick(hex);
      setPicking(null);
    }, 400);
  };
  return (
    <span className="flex shrink-0 items-center gap-1">
      {onReset && (
        <button type="button" onClick={onReset} className="min-h-11 px-2 text-[13px] font-medium text-accent">
          {resetLabel}
        </button>
      )}
      <span className="relative flex size-11 items-center justify-center">
        <span aria-hidden className="size-7 rounded-full ring-1 ring-separator" style={{ background: picking ?? color }} />
        <input type="color" aria-label={label} value={picking ?? value} onChange={(event) => pick(event.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
      </span>
    </span>
  );
}

/**
 * The colors this parent sees on the agenda: by person or by calendar. Kept in Homie for this parent only; the
 * connected calendar isn't changed, and the names and faces stay beside every color.
 */
export function CalendarColorsCard() {
  const { dict } = useI18n();
  const copy = dict.calendarColors;
  const userId = useAuth((s) => s.session?.userId) ?? "";
  const householdId = useAuth((s) => s.session?.householdId ?? null);
  const colors = usePrefsOf(userId, (prefs) => prefs.calendarColors);
  const update = usePrefs((s) => s.update);
  const members = useHousehold((s) => s.members);
  const calendarOwner = useCalendarItems((s) => s.owner);
  const allItems = useCalendarItems((s) => s.items);
  const items = calendarOwner === `${userId}:${householdId}` ? allItems : [];
  const [failed, setFailed] = useState(false);
  const calendars = [...new Map(items.flatMap((item) => (item.calendarKey && item.detail === "details" ? [[item.calendarKey, item] as const] : []))).values()];

  const save = (next: CalendarColors) => {
    setFailed(false);
    void update(userId, "calendarColors", next).then((result) => setFailed(result !== "saved"));
  };
  const setPerson = (id: string, hex: string | null) => {
    const people = { ...colors.people };
    if (hex) people[id] = hex;
    else delete people[id];
    save({ ...colors, people });
  };
  const setCalendar = (key: string, hex: string | null) => {
    const next = { ...colors.calendars };
    if (hex) next[key] = hex;
    else delete next[key];
    save({ ...colors, calendars: next });
  };
  const row = "flex min-h-14 items-center gap-3 px-4 py-row";

  return (
    <Card title={copy.title}>
      <div className="flex flex-col gap-2 p-3">
        <span className="px-1 text-[15px]">{copy.by}</span>
        <SegmentedControl
          label={copy.by}
          value={colors.by}
          onChange={(by) => save({ ...colors, by })}
          options={[
            { value: "person", label: copy.byPerson },
            { value: "calendar", label: copy.byCalendar },
          ]}
        />
      </div>
      {colors.by === "person" ? (
        <ul className="divide-y divide-separator border-t border-separator">
          {members.map((member) => (
            <li key={member.id} className={row}>
              <Avatar member={member} size={30} />
              <bdi title={member.name} className="min-w-0 flex-1 truncate text-[17px]">{firstName(member.name)}</bdi>
              <ColorPick
                label={format(copy.pick, { name: firstName(member.name) })}
                color={member.color}
                value={colors.people[member.id] ?? normalizeHex(member.color) ?? "#5a5f94"}
                onPick={(hex) => setPerson(member.id, hex)}
                onReset={colors.people[member.id] ? () => setPerson(member.id, null) : null}
                resetLabel={copy.reset}
              />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="divide-y divide-separator border-t border-separator">
          <li className={row}>
            <span className="min-w-0 flex-1 text-[17px]">{copy.home}</span>
            <ColorPick
              label={format(copy.pick, { name: copy.home })}
              color={colors.calendars.home ?? "var(--teal)"}
              value={colors.calendars.home ?? "#4a8696"}
              onPick={(hex) => setCalendar("home", hex)}
              onReset={colors.calendars.home ? () => setCalendar("home", null) : null}
              resetLabel={copy.reset}
            />
          </li>
          {calendars.map((item) => {
            const key = item.calendarKey!;
            const owner = members.find((member) => member.id === item.owners[0]);
            const name = [item.provider ? dict.agenda.providers[item.provider] : null, item.sourceName].filter(Boolean).join(" · ");
            return (
              <li key={key} className={row}>
                {owner && <Avatar member={owner} size={26} />}
                <span className="flex min-w-0 flex-1 flex-col">
                  <bdi title={name || undefined} className="truncate text-[17px]">{name || copy.calendars}</bdi>
                  {owner && <bdi className="text-[13px] text-label-secondary">{firstName(owner.name)}</bdi>}
                </span>
                <ColorPick
                  label={format(copy.pick, { name: name || copy.calendars })}
                  color={colors.calendars[key] ?? startingColor(key)}
                  value={colors.calendars[key] ?? "#4a8696"}
                  onPick={(hex) => setCalendar(key, hex)}
                  onReset={colors.calendars[key] ? () => setCalendar(key, null) : null}
                  resetLabel={copy.reset}
                />
              </li>
            );
          })}
          {calendars.length === 0 && <li className="px-4 py-3 text-[15px] text-label-secondary">{copy.noCalendars}</li>}
        </ul>
      )}
      <p className="px-4 pb-3 pt-1 text-[13px] leading-snug text-label-secondary">
        {copy.lead} {copy.hint}
      </p>
      {failed && (
        <p role="alert" className="px-4 pb-3 text-[13px] text-danger">
          {copy.failed}
        </p>
      )}
    </Card>
  );
}
