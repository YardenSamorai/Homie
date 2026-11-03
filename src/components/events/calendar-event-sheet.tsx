"use client";

import { Fragment, useState } from "react";
import { create } from "zustand";
import { ExternalLink } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Sheet, SheetBody, SheetHeader, sheetGroup } from "@/components/ui/sheet";
import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
import type { CalendarItem } from "@/lib/agenda";
import { useAuth } from "@/lib/auth/session";
import { fromDayKey } from "@/lib/dates";
import { firstName } from "@/lib/day-story";
import { useHousehold } from "@/lib/household-store";
import { fixCalendarEvent } from "@/lib/supabase/house-extras";
import { reloadHouseCalendar } from "@/components/shell/house-extras-sync";

export const useCalendarSheet = create<{ item: CalendarItem | null; open: (item: CalendarItem) => void; close: () => void }>()((set) => ({
  item: null,
  open: (item) => set({ item }),
  close: () => set({ item: null }),
}));

const PREP_MAX = 200;

function useWhen(item: CalendarItem) {
  const { locale } = useI18n();
  const day = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" });
  if (item.allDay) {
    const first = fromDayKey(item.startDay);
    const last = fromDayKey(item.endDay);
    return item.startDay === item.endDay ? day.format(first) : day.formatRange(first, last);
  }
  const start = new Date(item.startsAt!);
  const end = new Date(item.endsAt!);
  return new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).formatRange(start, end);
}

function EventForm({ item, onDone }: { item: CalendarItem; onDone: () => void }) {
  const { dict } = useI18n();
  const copy = dict.agenda;
  const members = useHousehold((s) => s.members);
  const userId = useAuth((s) => s.session?.userId ?? null);
  const householdId = useAuth((s) => s.session?.householdId ?? null);
  const [people, setPeople] = useState<string[]>(item.people);
  const [prep, setPrep] = useState(item.prep ?? "");
  const [state, setState] = useState<"idle" | "saving" | "failed">("idle");
  const when = useWhen(item);
  const owners = members.filter((member) => item.owners.includes(member.id));
  const source = [
    item.provider ? copy.providers[item.provider] : null,
    item.sourceName,
    owners.map((member) => firstName(member.name)).join(", ") || null,
  ].filter((part): part is string => !!part);
  const samePeople = people.length === item.people.length && people.every((id) => item.people.includes(id));
  const changed = !samePeople || prep.trim() !== (item.prep ?? "");

  const toggle = (id: string) => setPeople((now) => (now.includes(id) ? now.filter((p) => p !== id) : [...now, id]));

  const save = async (reset = false) => {
    setState("saving");
    // A correction rides on every copy of the meeting, or the copy left alone would bring the old list back.
    const taking = reset ? null : item.fixed || !samePeople ? people : null;
    const note = reset ? item.prep : prep.trim() || null;
    const results = await Promise.all(item.ids.map((id) => fixCalendarEvent(id, taking, note)));
    if (results.some((ok) => !ok)) {
      setState("failed");
      return;
    }
    if (userId && householdId) await reloadHouseCalendar(userId, householdId).catch(() => {});
    onDone();
  };

  return (
    <>
      <SheetHeader
        title={copy.eventTitle}
        cancel={dict.add.cancel}
        action={{ label: dict.add.save, onClick: () => void save(), disabled: !changed || state === "saving" }}
      />
      <SheetBody>
        <div className="px-1">
          <h3 dir="auto" className="align-ui text-xl font-semibold leading-snug tracking-tight [overflow-wrap:anywhere]">
            {item.title}
          </h3>
          <p className="mt-1 text-[15px] text-label-secondary first-letter:uppercase">{when}</p>
          {item.tentative && <p className="mt-0.5 text-[15px] text-label-secondary">{copy.tentativeLong}</p>}
        </div>

        <div className={sheetGroup}>
          <div className="flex flex-col gap-0.5 px-4 py-3">
            <span className="text-[13px] text-label-secondary">{copy.fromCalendar}</span>
            <span className="text-[17px] [overflow-wrap:anywhere]">
              {source.map((part, i) => (
                <Fragment key={i}>
                  {i > 0 && " · "}
                  <bdi>{part}</bdi>
                </Fragment>
              ))}
            </span>
          </div>
          {item.link && (
            <a
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-12 items-center gap-2 px-4 text-[17px] text-accent active:bg-fill"
            >
              <ExternalLink aria-hidden size={17} className="rtl:-scale-x-100" />
              {item.provider ? format(copy.openIn, { provider: copy.providers[item.provider] }) : copy.openSource}
            </a>
          )}
        </div>

        <div>
          <p className="px-4 pb-1.5 text-[13px] font-medium text-label-secondary">{copy.takingPart}</p>
          <div role="group" aria-label={copy.takingPart} className="flex flex-wrap gap-2">
            {members.map((member) => {
              const on = people.includes(member.id);
              return (
                <button
                  key={member.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(member.id)}
                  style={on ? { boxShadow: `inset 0 0 0 2px ${member.color}` } : undefined}
                  className={`flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-surface px-3 text-[17px] transition-[scale] duration-100 ease-out active:scale-[0.97] ${on ? "font-semibold" : "text-label-secondary"}`}
                >
                  <span className={on ? "" : "opacity-50"}>
                    <Avatar member={member} size={26} />
                  </span>
                  <bdi className="truncate">{firstName(member.name)}</bdi>
                </button>
              );
            })}
          </div>
          {item.fixed && (
            <button
              type="button"
              onClick={() => void save(true)}
              disabled={state === "saving"}
              className="mt-2 min-h-11 px-4 text-[15px] font-medium text-accent disabled:opacity-40"
            >
              {copy.resetPeople}
            </button>
          )}
        </div>

        <div>
          <label htmlFor="calendar-prep" className="block px-4 pb-1.5 text-[13px] font-medium text-label-secondary">
            {dict.events.prep}
          </label>
          <textarea
            id="calendar-prep"
            dir="auto"
            rows={2}
            maxLength={PREP_MAX}
            value={prep}
            onChange={(e) => setPrep(e.target.value)}
            placeholder={copy.prepPlaceholder}
            className="w-full resize-none rounded-xl bg-surface px-4 py-3 text-[17px] leading-snug outline-none placeholder:text-label-tertiary focus-visible:ring-2 focus-visible:ring-accent"
          />
        </div>

        {state === "failed" && (
          <p role="alert" className="px-4 text-[15px] text-danger">
            {copy.saveFailed}
          </p>
        )}
        <p className="px-4 text-[13px] leading-snug text-label-secondary">{copy.localOnly}</p>
      </SheetBody>
    </>
  );
}

/** An imported meeting, in full for whoever may see it. What's changed here stays in Homie. */
export function CalendarEventSheet() {
  const item = useCalendarSheet((s) => s.item);
  const close = useCalendarSheet((s) => s.close);
  const [shown, setShown] = useState(item);
  if (item && item !== shown) setShown(item);
  return (
    <Sheet open={item !== null} onOpenChange={(open) => !open && close()}>
      {shown && <EventForm key={shown.id} item={shown} onDone={close} />}
    </Sheet>
  );
}
