"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { AgendaRow } from "@/components/events/agenda-row";
import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
import type { AgendaEntry } from "@/lib/agenda";

const card = "overflow-hidden rounded-card bg-surface shadow-card ring-1 ring-hairline";
const rule = "relative after:absolute after:inset-x-0 after:top-0 after:ms-[5.4rem] after:h-px after:bg-separator first:after:hidden";

/** What's still ahead today, in time order, home events and connected calendars together. */
export function TodayAgenda({ entries, hidden, stale }: { entries: AgendaEntry[]; hidden: number; stale: boolean }) {
  const { locale, dict } = useI18n();
  if (entries.length === 0) return null;
  return (
    <section aria-labelledby="later-today">
      <h2 id="later-today" className="px-1 text-[20px] font-bold tracking-[-0.01em]">
        {dict.today.laterToday}
      </h2>
      <div className={`${card} mt-2`}>
        <ul>
          {entries.map((entry) => (
            <li key={entry.key} className={rule}>
              <AgendaRow entry={entry} />
            </li>
          ))}
        </ul>
        {hidden > 0 && (
          <Link
            href={`/${locale}/calendar`}
            className={`${rule} after:!block flex min-h-12 items-center justify-between gap-2 ps-[5.4rem] pe-4 text-[15px] font-medium text-accent transition-colors duration-150 active:bg-fill`}
          >
            {hidden === 1 ? dict.agenda.moreOne : format(dict.agenda.more, { count: hidden })}
            <ChevronLeft aria-hidden size={17} className="ltr:-scale-x-100" />
          </Link>
        )}
      </div>
      {stale && <p className="mt-2 px-1 text-[13px] text-label-secondary">{dict.agenda.stale}</p>}
    </section>
  );
}
