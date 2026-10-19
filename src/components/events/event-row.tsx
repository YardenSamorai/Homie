"use client";

import { ClipboardList } from "lucide-react";
import { useI18n } from "@/i18n/dictionary-provider";
import type { HouseEvent } from "@/lib/household";

/** Apple Calendar agenda: color rail, time, then the title. */
export function EventRow({ event, caption }: { event: HouseEvent; caption?: string }) {
  const { dict } = useI18n();
  const when = caption ?? event.time ?? dict.events.allDay;
  const extra = caption && event.time ? event.time : null;

  return (
    <div className="flex min-h-[52px] items-stretch gap-3 px-4 py-2">
      <span aria-hidden className="my-2.5 w-1 shrink-0 rounded-full bg-teal" />
      <span className="shrink-0 self-center text-[15px] tabular-nums leading-tight text-label-secondary">
        {when}
      </span>
      <div className="flex min-w-0 flex-1 flex-col justify-center text-start">
        <span className="truncate text-start text-[17px] font-medium">{event.title}</span>
        {(event.prep || extra) && (
          <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[13px] text-label-secondary">
            {extra && <span className="tabular-nums">{extra}</span>}
            {event.prep && (
              <>
                {extra && <span aria-hidden className="text-label-tertiary">·</span>}
                <ClipboardList aria-hidden size={13} className="shrink-0 text-orange" />
                <span className="sr-only">{dict.events.prep}: </span>
                <span className="truncate">{event.prep}</span>
              </>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
