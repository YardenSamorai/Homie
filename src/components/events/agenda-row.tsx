"use client";

import { ClipboardList } from "lucide-react";
import { Fragment } from "react";
import { SyncCaption } from "@/components/ui/sync-note";
import { useI18n } from "@/i18n/dictionary-provider";
import type { AgendaEntry } from "@/lib/agenda";
import { useAddSheet, useHousehold } from "@/lib/household-store";
import { PeopleMark } from "./people-mark";
import { useCalendarSheet } from "./calendar-event-sheet";

/**
 * One line of a day: the time on the start side, then what it is, who it's for, what to prepare and, for an imported
 * meeting, which calendar it came from. A busy block says only that the time is taken, and by whom.
 * Titles and prep wrap instead of being cut.
 */
export function AgendaRow({ entry, caption }: { entry: AgendaEntry; caption?: string }) {
  const { dict } = useI18n();
  const showEdit = useAddSheet((s) => s.showEdit);
  const openImported = useCalendarSheet((s) => s.open);
  const members = useHousehold((s) => s.members);
  const only = entry.people.length === 1 ? members.find((member) => member.id === entry.people[0]) : undefined;
  const rail = entry.busy ? "var(--separator)" : entry.kind === "calendar" && only ? only.color : "var(--teal)";
  const item = entry.item;
  const source = item && !entry.busy && item.provider ? [dict.agenda.providers[item.provider], item.sourceName].filter(Boolean) : null;

  const wholeDay = entry.allDay || (entry.continues && !entry.endLabel);
  const top = wholeDay ? dict.events.allDay : entry.continues ? dict.agenda.untilShort : entry.startLabel;
  const bottom = wholeDay ? null : entry.endLabel;

  const body = (
    <>
      <span aria-hidden className="my-1 w-1 shrink-0 rounded-full" style={{ background: rail }} />
      <span className="flex w-[3.4rem] shrink-0 flex-col pt-px text-[15px] leading-tight tabular-nums">
        <span className={entry.busy ? "text-label-secondary" : "font-medium"}>{caption ?? top}</span>
        {bottom && <span className="mt-0.5 text-[13px] text-label-tertiary">{bottom}</span>}
        {caption && top && <span className="mt-0.5 text-[13px] text-label-tertiary">{top}</span>}
      </span>
      <span className="flex min-w-0 flex-1 flex-col text-start">
        <span
          dir="auto"
          className={`align-ui text-[17px] leading-snug [overflow-wrap:anywhere] ${entry.busy ? "text-label-secondary" : "font-medium"}`}
        >
          {entry.busy ? dict.agenda.busy : entry.title}
        </span>
        <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13px] text-label-secondary">
          {entry.people.length > 0 && <PeopleMark people={entry.people} />}
          {item?.tentative && !entry.busy && (
            <>
              {entry.people.length > 0 && <span aria-hidden className="text-label-tertiary">·</span>}
              <span>{dict.agenda.tentative}</span>
            </>
          )}
          {source && (
            <>
              <span aria-hidden className="text-label-tertiary">·</span>
              <span className="sr-only">{dict.agenda.from} </span>
              <span className="min-w-0 text-label-tertiary [overflow-wrap:anywhere]">
                {source.map((part, i) => (
                  <Fragment key={i}>
                    {i > 0 && " · "}
                    <bdi>{part}</bdi>
                  </Fragment>
                ))}
              </span>
            </>
          )}
        </span>
        {entry.prep && !entry.busy && (
          <span className="mt-1 flex min-w-0 items-start gap-1.5 text-[14px] leading-snug text-label-secondary">
            <ClipboardList aria-hidden size={14} className="mt-[3px] shrink-0 text-orange" />
            <span className="sr-only">{dict.events.prep}: </span>
            <span dir="auto" className="min-w-0 [overflow-wrap:anywhere]">
              {entry.prep}
            </span>
          </span>
        )}
        {entry.event && <SyncCaption id={entry.event.id} />}
      </span>
    </>
  );

  const rowClass = "flex min-h-[56px] w-full items-stretch gap-3 px-4 py-2.5";
  if (entry.event) {
    const event = entry.event;
    return (
      <button
        type="button"
        onClick={() => showEdit({ kind: "event", id: event.id })}
        className={`${rowClass} touch-manipulation select-none text-start transition-colors duration-150 active:bg-fill`}
      >
        {body}
      </button>
    );
  }
  if (item && !entry.busy) {
    return (
      <button
        type="button"
        onClick={() => openImported(item)}
        className={`${rowClass} touch-manipulation select-none text-start transition-colors duration-150 active:bg-fill`}
      >
        {body}
      </button>
    );
  }
  return <div className={rowClass}>{body}</div>;
}
