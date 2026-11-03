"use client";

import { ClipboardList } from "lucide-react";
import { useCalendarSheet } from "@/components/events/calendar-event-sheet";
import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
import type { AgendaEntry } from "@/lib/agenda";
import { useAddSheet } from "@/lib/household-store";

/** Tomorrow's events that need something ready, one line each. Nothing at all when there's nothing to prepare. */
export function TomorrowPrep({ entries }: { entries: AgendaEntry[] }) {
  const { dict } = useI18n();
  const showEdit = useAddSheet((s) => s.showEdit);
  const openImported = useCalendarSheet((s) => s.open);
  const withPrep = entries.filter((entry) => entry.prep && !entry.busy).slice(0, 3);
  if (withPrep.length === 0) return null;

  return (
    <section aria-labelledby="tomorrow-prep" className="rounded-card bg-surface/70 px-4 py-3 ring-1 ring-hairline">
      <h2 id="tomorrow-prep" className="flex items-center gap-1.5 text-[15px] font-semibold text-label-secondary">
        <ClipboardList aria-hidden size={16} className="text-orange" />
        {dict.agenda.tomorrowPrep}
      </h2>
      <ul className="mt-1">
        {withPrep.map((entry) => {
          const when = entry.allDay || !entry.startLabel ? dict.agenda.tomorrow : format(dict.agenda.tomorrowAt, { time: entry.startLabel });
          const open = () => {
            if (entry.event) showEdit({ kind: "event", id: entry.event.id });
            else if (entry.item) openImported(entry.item);
          };
          return (
            <li key={entry.key}>
              <button
                type="button"
                onClick={open}
                className="-mx-2 flex min-h-11 w-[calc(100%+1rem)] flex-col justify-center rounded-xl px-2 py-1.5 text-start text-[15px] leading-snug transition-colors duration-150 active:bg-fill"
              >
                <span className="[overflow-wrap:anywhere]">
                  <span className="font-medium tabular-nums">{when}</span>{" "}
                  <bdi className="font-medium">{entry.title}</bdi>
                </span>
                <span dir="auto" className="align-ui text-label-secondary [overflow-wrap:anywhere]">
                  {entry.prep}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
