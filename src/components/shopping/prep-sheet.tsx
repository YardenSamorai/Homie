"use client";

import { useState } from "react";
import { Sheet, SheetBody, SheetHeader } from "@/components/ui/sheet";
import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
import { knownAisle } from "@/lib/aisles";
import { fromDayKey } from "@/lib/dates";
import { itemKey } from "@/lib/groceries";
import type { HouseEvent } from "@/lib/household";
import { useHousehold } from "@/lib/household-store";
import { parseItems } from "@/lib/shopping-parse";
import { useAmountText } from "./item-meta";
import { notOnList, PickList, usePickCopy, type PickLine } from "./pick-list";

function PrepForm({ event, onDone }: { event: HouseEvent; onDone: (count: number) => void }) {
  const { dict, locale } = useI18n();
  const copy = dict.shopping;
  const shopping = useHousehold((s) => s.shopping);
  const amountText = useAmountText();
  const addLabel = usePickCopy();
  const parsed = parseItems(event.prep ?? "", (name) => knownAisle(name) !== null);
  const fromEvent = new Set(shopping.filter((item) => item.eventId === event.id).map((item) => itemKey(item.name)));
  const listed = new Set(shopping.filter((item) => !item.checkedAt).map((item) => itemKey(item.name)));
  const already = parsed.map((item) => fromEvent.has(itemKey(item.name)));
  const lines: PickLine[] = parsed.map((item, index) => {
    const key = itemKey(item.name);
    return {
      key: `${index}-${key}`,
      name: item.name,
      detail: already[index] ? copy.prepAlready : amountText(item),
      onList: listed.has(key) && !already[index],
    };
  });
  // Things already added from this event, or already waiting on the list, start unpicked.
  const [picked, setPicked] = useState(() => {
    const start = notOnList(lines);
    lines.forEach((line, index) => already[index] && start.delete(line.key));
    return start;
  });
  const toggle = (key: string) =>
    setPicked((set) => {
      const next = new Set(set);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const date = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }).format(fromDayKey(event.date));

  const add = () => {
    const { addShoppingItem } = useHousehold.getState();
    const chosen = parsed.filter((_, index) => picked.has(lines[index].key));
    for (const item of chosen) addShoppingItem({ name: item.name, note: null, quantity: item.quantity, unit: item.unit, eventId: event.id });
    onDone(chosen.length);
  };

  return (
    <>
      <SheetHeader title={copy.prepTitle} cancel={dict.add.cancel} action={{ label: addLabel(picked.size), onClick: add, disabled: picked.size === 0 }} />
      <SheetBody>
        <div className="px-1">
          <h3 dir="auto" className="text-xl font-semibold tracking-tight">
            {event.title}
          </h3>
          <p className="text-[15px] text-label-secondary">{date}</p>
        </div>
        {lines.length === 0 ? (
          <p className="px-4 text-[17px] text-label-secondary">{copy.prepNothing}</p>
        ) : (
          <PickList label={format(copy.prepFor, { title: event.title })} lines={lines} picked={picked} onToggle={toggle} />
        )}
        <p className="px-4 text-[13px] text-label-secondary">{copy.prepHint}</p>
      </SheetBody>
    </>
  );
}

/** An event's "what to prepare", picked into the shopping list: each item added is linked back to the event. */
export function PrepSheet({ event, onOpenChange, onAdded }: { event: HouseEvent | null; onOpenChange: (open: boolean) => void; onAdded?: (count: number) => void }) {
  // The event stays drawn while the sheet slides away.
  const [shown, setShown] = useState(event);
  if (event && event !== shown) setShown(event);
  return (
    <Sheet open={event !== null} onOpenChange={onOpenChange}>
      {shown && (
        <PrepForm
          key={shown.id}
          event={shown}
          onDone={(count) => {
            onOpenChange(false);
            onAdded?.(count);
          }}
        />
      )}
    </Sheet>
  );
}
