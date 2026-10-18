"use client";

import { ClipboardList } from "lucide-react";
import { useI18n } from "@/i18n/dictionary-provider";
import type { HouseEvent } from "@/lib/household";

/** Apple Calendar-style row: colored edge, time column, title, and what to prepare. */
export function EventRow({ event, caption }: { event: HouseEvent; caption?: string }) {
  const { dict } = useI18n();

  return (
    <div className="flex min-h-14 items-stretch gap-3 px-4 py-2.5">
      <span aria-hidden className="w-1 shrink-0 rounded-full bg-accent" />
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <span className="truncate text-[17px] font-medium">{event.title}</span>
        {event.prep && (
          <span className="flex items-center gap-1.5 text-[13px] text-label-secondary">
            <ClipboardList aria-hidden size={13} className="shrink-0 text-orange" />
            <span className="sr-only">{dict.events.prep}: </span>
            <span className="truncate">{event.prep}</span>
          </span>
        )}
      </div>
      <span className="flex shrink-0 flex-col items-end justify-center text-end text-[13px] tabular-nums text-label-secondary">
        {caption && <span className="font-semibold text-label">{caption}</span>}
        {event.time ?? dict.events.allDay}
      </span>
    </div>
  );
}
