"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
import type { DayKey } from "@/lib/dates";
import { sortEvents } from "@/lib/household";
import { useAddSheet, useHousehold } from "@/lib/household-store";
import { loadForMember } from "@/lib/tasks";

/** Personal line under the household row. Always one title line so the layout does not jump. */
export function PersonalWait({ today }: { today: DayKey }) {
  const { dict } = useI18n();
  const { tasks, currentUserId } = useHousehold();
  const load = loadForMember(tasks, currentUserId, today);
  const title =
    load.open === 0
      ? dict.today.waitingNone
      : load.open === 1
        ? dict.today.waitingOne
        : format(dict.today.waitingMany, { count: load.open });

  return (
    <div className="px-0.5">
      <p className="text-[22px] font-semibold leading-tight tracking-tight">{title}</p>
      <p className="mt-0.5 h-5 text-[13px] leading-snug text-danger">
        {load.overdue === 1
          ? dict.today.waitingOverdueOne
          : load.overdue > 1
            ? format(dict.today.waitingOverdue, { count: load.overdue })
            : null}
      </p>
    </div>
  );
}

/** Same sheet as the tab-bar +, written as a sentence field so adding feels like sending a message. */
export function QuickAddBar({ day }: { day: DayKey }) {
  const { dict } = useI18n();
  const show = useAddSheet((s) => s.show);

  return (
    <button
      type="button"
      onClick={() => show("task", day)}
      aria-haspopup="dialog"
      className="flex min-h-11 w-full touch-manipulation select-none items-center gap-3 rounded-card bg-surface px-3.5 text-start shadow-card ring-1 ring-[light-dark(rgb(40_30_20/0.04),rgb(255_255_255/0.06))] transition-transform duration-150 ease-out active:scale-[0.97]"
    >
      <span
        aria-hidden
        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-accent-contrast"
      >
        <Plus size={16} strokeWidth={2.5} />
      </span>
      <span className="min-w-0 flex-1 truncate text-[16px] text-label-secondary">{dict.today.quickAddHint}</span>
    </button>
  );
}

function Tile({
  href,
  color,
  count,
  label,
  caption,
  captionClass = "text-label-secondary",
}: {
  href: string;
  color: string;
  count: number;
  label: string;
  caption: string;
  captionClass?: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-[5.5rem] min-w-0 touch-manipulation select-none overflow-hidden rounded-[22px] bg-surface shadow-card ring-1 ring-[light-dark(rgb(40_30_20/0.06),rgb(255_255_255/0.08))] transition-transform duration-150 ease-out active:scale-[0.97]"
    >
      <span aria-hidden className="w-1.5 shrink-0" style={{ backgroundColor: color }} />
      <span className="flex min-w-0 flex-1 flex-col justify-between gap-2 px-3.5 py-3">
        <span className="truncate text-[15px] font-semibold leading-tight" style={{ color }}>
          {label}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-[22px] font-bold leading-none tabular-nums tracking-tight text-label">{count}</span>
          <span className={`mt-1 truncate text-[12px] leading-snug ${captionClass}`}>{caption}</span>
        </span>
      </span>
    </Link>
  );
}

/** Four V1 domains at a glance. Money and meals stay out of scope. */
export function DomainTiles({ today }: { today: DayKey }) {
  const { locale, dict } = useI18n();
  const { tasks, shopping, events } = useHousehold();

  const openToday = tasks.filter((t) => !t.completedAt && t.dueDate === today).length;
  const overdue = tasks.filter((t) => !t.completedAt && t.dueDate && t.dueDate < today).length;
  const shopLeft = shopping.filter((item) => !item.checkedAt).length;
  const nextEvent = events.filter((e) => e.date >= today).sort(sortEvents)[0];

  const taskCaption =
    overdue > 0
      ? overdue === 1
        ? dict.today.tileOverdueOne
        : format(dict.today.tileOverdue, { count: overdue })
      : openToday === 1
        ? dict.today.summary.one
        : openToday === 0
          ? dict.today.summary.none
          : format(dict.today.summary.many, { count: openToday });

  return (
    <section aria-label={dict.today.atHome} className="flex flex-col gap-2">
      <h2 className="px-1 text-[22px] font-bold tracking-tight">{dict.today.atHome}</h2>
      <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-3">
        <Tile
          href={`/${locale}/tasks`}
          color="var(--sage)"
          count={openToday}
          label={dict.nav.tasks}
          caption={taskCaption}
          captionClass={overdue > 0 ? "text-danger" : "text-label-secondary"}
        />
        <Tile
          href={`/${locale}/shopping`}
          color="var(--coral)"
          count={shopLeft}
          label={dict.nav.shopping}
          caption={shopLeft === 0 ? dict.today.shoppingEmpty : dict.today.tileShopLeft}
        />
        <Tile
          href={`/${locale}/calendar`}
          color="var(--sage-dark)"
          count={nextEvent ? 1 : 0}
          label={dict.today.nextEvent}
          caption={nextEvent ? nextEvent.title : dict.today.noNextEvent}
        />
      </div>
    </section>
  );
}
