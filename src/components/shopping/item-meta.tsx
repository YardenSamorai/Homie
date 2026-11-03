"use client";

import { CalendarDays, ListTodo, Repeat, SearchX } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
import { fromDayKey } from "@/lib/dates";
import type { ShoppingItem } from "@/lib/household";
import { useHousehold } from "@/lib/household-store";
import { formatAmount, type Amount } from "@/lib/quantity";

/** "2", "1.5 ק״ג": the amount as the row shows it, or null. */
export function useAmountText() {
  const { dict, locale } = useI18n();
  const labels = { one: dict.shopping.unitsOne, many: dict.shopping.units };
  return (amount: Amount) => formatAmount(amount, locale, labels);
}

/** What the shopper should know about a substitute, or null when nobody said. */
export function useSubstituteText() {
  const { dict } = useI18n();
  return (item: ShoppingItem) =>
    item.substituteMode === "allowed"
      ? dict.shopping.subAllowed
      : item.substituteMode === "none"
        ? dict.shopping.subNone
        : item.substituteMode === "specific" && item.substitute
          ? format(dict.shopping.subSpecific, { name: item.substitute })
          : null;
}

/** Everyone who asked for this item other than the parent looking at it. */
export function useAskers(item: ShoppingItem) {
  const { members, currentUserId } = useHousehold();
  const ids = [item.addedBy, ...item.requestedBy].filter((id, index, all) => id !== currentUserId && all.indexOf(id) === index);
  return ids.flatMap((id) => members.filter((member) => member.id === id));
}

export function Askers({ item, size = 24, dim = false }: { item: ShoppingItem; size?: number; dim?: boolean }) {
  const { dict } = useI18n();
  const askers = useAskers(item);
  if (askers.length === 0) return null;
  const label = format(dict.shopping.addedBy, { name: askers.map((member) => member.name).join(", ") });
  return (
    <span title={label} className={`relative flex shrink-0 -space-x-1.5 rtl:space-x-reverse ${dim ? "opacity-60" : ""}`}>
      {askers.map((member) => (
        <span key={member.id} className="rounded-full ring-2 ring-surface">
          <Avatar member={member} size={size} />
        </span>
      ))}
      <span className="sr-only">{label}</span>
    </span>
  );
}

/**
 * The line under an item's name: its amount and note, then quiet marks for what it's for (an event, a task),
 * the substitute preference, and "not found". The event links back to its day in the calendar.
 */
export function ItemMeta({ item, large = false }: { item: ShoppingItem; large?: boolean }) {
  const { dict, locale } = useI18n();
  const { events, tasks } = useHousehold();
  const amountText = useAmountText();
  const substitute = useSubstituteText()(item);
  const amount = amountText(item);
  const event = item.eventId ? events.find((known) => known.id === item.eventId) : undefined;
  const task = item.taskId ? tasks.find((known) => known.id === item.taskId) : undefined;
  const text = [amount, item.note].filter(Boolean).join(" · ");
  const size = large ? "text-[17px]" : "text-[13px]";
  const chip = `inline-flex max-w-full items-center gap-1 ${large ? "text-[15px]" : "text-[13px]"}`;
  const day = event ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(fromDayKey(event.date)) : null;

  if (!text && !substitute && !event && !task && !item.missingAt) return null;
  return (
    <span className="flex min-w-0 flex-col">
      {text && (
        <span dir="auto" className={`max-w-full self-start ${large ? "" : "truncate"} ${size} ${large ? "font-medium text-label" : "text-label-secondary"}`}>
          {text}
        </span>
      )}
      {(substitute || event || task || item.missingAt) && (
        <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-label-secondary">
          {item.missingAt && (
            <span className={`${chip} font-medium text-label`}>
              <SearchX aria-hidden size={14} strokeWidth={2.25} className="text-orange" />
              {dict.shopping.missingTag}
            </span>
          )}
          {substitute && (
            <span className={chip}>
              <Repeat aria-hidden size={13} strokeWidth={2.25} />
              <span className="truncate">{substitute}</span>
            </span>
          )}
          {event && (
            // Plain text: the row is one button. The item's sheet links back to the event.
            <span className={chip}>
              <CalendarDays aria-hidden size={13} strokeWidth={2.25} className="text-teal" />
              <span className="sr-only">{format(dict.shopping.forEventNamed, { title: event.title, date: day ?? "" })}</span>
              <span aria-hidden className="truncate">
                {event.title} · {day}
              </span>
            </span>
          )}
          {task && (
            <span className={chip}>
              <ListTodo aria-hidden size={13} strokeWidth={2.25} />
              <span className="truncate">{task.title}</span>
            </span>
          )}
        </span>
      )}
    </span>
  );
}
