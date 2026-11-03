"use client";

import { ClipboardList } from "lucide-react";
import { SyncCaption } from "@/components/ui/sync-note";
import { firstName } from "@/lib/day-story";
import { useI18n } from "@/i18n/dictionary-provider";
import type { HouseEvent } from "@/lib/household";
import { useHousehold } from "@/lib/household-store";

/** Apple Calendar agenda: color rail, time, then the title. */
export function EventRow({ event, caption }: { event: HouseEvent; caption?: string }) {
  const { dict } = useI18n();
  const who = useHousehold((s) => (event.attendeeId ? s.members.find((member) => member.id === event.attendeeId) : undefined));
  // Lists saved on the phone before times were trimmed still carry seconds.
  const time = event.time ? event.time.slice(0, 5) : null;
  const when = caption ?? time ?? dict.events.allDay;
  const extra = caption && time ? time : null;

  return (
    <div className="flex min-h-[52px] items-stretch gap-3 px-4 py-2">
      <span aria-hidden className="my-2.5 w-1 shrink-0 rounded-full bg-teal" />
      <span className="shrink-0 self-center text-[15px] tabular-nums leading-tight text-label-secondary">
        {when}
      </span>
      <div className="flex min-w-0 flex-1 flex-col justify-center text-start">
        <span dir="auto" className="align-ui line-clamp-2 text-[17px] font-medium leading-snug [overflow-wrap:anywhere]">
          {event.title}
        </span>
        {(event.prep || extra || who) && (
          <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[13px] text-label-secondary">
            {extra && <span className="tabular-nums">{extra}</span>}
            {who && (
              <>
                {extra && <span aria-hidden className="text-label-tertiary">·</span>}
                <span className="sr-only">{dict.events.who}: </span>
                <span className="truncate">{firstName(who.name)}</span>
              </>
            )}
            {event.prep && (
              <>
                {(extra || who) && <span aria-hidden className="text-label-tertiary">·</span>}
                <ClipboardList aria-hidden size={13} className="shrink-0 text-orange" />
                <span className="sr-only">{dict.events.prep}: </span>
                <span className="truncate">{event.prep}</span>
              </>
            )}
          </span>
        )}
        <SyncCaption id={event.id} />
      </div>
    </div>
  );
}
