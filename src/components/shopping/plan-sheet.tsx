"use client";

import { useState } from "react";
import { ChevronLeft, Pin, Plus, X } from "lucide-react";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Sheet, SheetBody, SheetHeader, sheetGroup } from "@/components/ui/sheet";
import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
import { itemKey } from "@/lib/groceries";
import type { GroupLine, ShoppingGroup, ShoppingTrip } from "@/lib/household";
import { useHousehold, type NewShoppingItem } from "@/lib/household-store";
import { parseItems } from "@/lib/shopping-parse";
import { suggestProducts, type Suggestion } from "@/lib/shopping-suggest";
import { knownAisle } from "@/lib/aisles";
import { fromDayKey } from "@/lib/dates";
import { useClock } from "@/lib/use-clock";
import { useAmountText } from "./item-meta";
import { notOnList, PickList, usePickCopy, type PickLine } from "./pick-list";
import { useShoppingActions } from "./shopping-actions";

type Tab = "suggest" | "groups" | "history";
type View = { tab: Tab } | { tab: "groups"; group: string } | { tab: "groups"; edit: string | "new" } | { tab: "history"; trip: string };

const lineDetail = (amount: string | null, note: string | null) => [amount, note].filter(Boolean).join(" · ") || null;

/** "נקנה לאחרונה לפני 8 ימים · בערך כל 7 ימים": only what the house's own trips show. */
export function useReasonText() {
  const { dict, locale } = useI18n();
  const copy = dict.shopping;
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const ago = (days: number) => relative.format(-days, "day");
  return (suggestion: Suggestion) => {
    const reason = suggestion.reason;
    if (reason.kind === "starter") return null;
    if (reason.kind === "staple") return reason.lastDays === null ? copy.reasonStaple : `${copy.reasonStaple} · ${format(copy.reasonLast, { when: ago(reason.lastDays) })}`;
    const last = format(copy.reasonLast, { when: ago(reason.lastDays) });
    return reason.everyDays ? `${last} · ${format(copy.reasonEvery, { days: reason.everyDays })}` : last;
  };
}

/** The same reason, short enough for a chip: "לפני 8 ימים", "קבוע". */
export function useShortReason() {
  const { dict, locale } = useI18n();
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  return (suggestion: Suggestion) => {
    const reason = suggestion.reason;
    if (reason.kind === "starter") return null;
    if (reason.kind === "habit" || reason.lastDays !== null) return relative.format(-(reason.lastDays ?? 0), "day");
    return dict.shopping.reasonStaple;
  };
}

/** What the house tends to buy and what's offered next, with the product's starter list for a new house. */
export function useSuggestions() {
  const { dict } = useI18n();
  const { shopping, trips, products } = useHousehold();
  const clock = useClock();
  if (!clock) return [];
  return suggestProducts({
    trips,
    products: Object.values(products),
    onList: shopping.filter((item) => !item.checkedAt).map((item) => item.name),
    starters: Object.values(dict.shopping.staplesItems),
    now: fromDayKey(clock.today).getTime() + clock.hour * 3_600_000,
  });
}

const toNew = (line: { name: string; quantity: number | null; unit: GroupLine["unit"]; note: string | null }): NewShoppingItem => ({
  name: line.name,
  quantity: line.quantity,
  unit: line.unit,
  note: line.note,
});

function AddBar({ count, onAdd }: { count: number; onAdd: () => void }) {
  const label = usePickCopy();
  return (
    <button
      type="button"
      onClick={onAdd}
      disabled={count === 0}
      className="sticky bottom-0 min-h-12 w-full shrink-0 rounded-xl bg-accent text-[17px] font-semibold text-accent-contrast shadow-card transition-transform duration-150 ease-out active:scale-[0.98] disabled:opacity-40"
    >
      {label(count)}
    </button>
  );
}

function usePicked(initial: () => Set<string>) {
  const [picked, setPicked] = useState(initial);
  const toggle = (key: string) =>
    setPicked((set) => {
      const next = new Set(set);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  return [picked, toggle] as const;
}

function SuggestTab({ onAdd }: { onAdd: (items: NewShoppingItem[]) => void }) {
  const { dict } = useI18n();
  const copy = dict.shopping;
  const products = useHousehold((s) => s.products);
  const actions = useShoppingActions();
  const suggestions = useSuggestions();
  const reasonText = useReasonText();
  const amountText = useAmountText();
  const [picked, toggle] = usePicked(() => new Set());

  if (suggestions.length === 0) return <p className="px-4 pt-2 text-[17px] text-label-secondary">{copy.planEmpty}</p>;

  const sections = (["staple", "habit", "starter"] as const)
    .map((kind) => ({ kind, items: suggestions.filter((s) => s.reason.kind === kind) }))
    .filter((section) => section.items.length > 0);
  const title = { staple: copy.staplesSection, habit: copy.habitsSection, starter: copy.startersSection };

  return (
    <>
      {sections.map((section) => (
        <section key={section.kind}>
          <h3 className="px-4 pb-1.5 text-[13px] text-label-secondary">{title[section.kind]}</h3>
          <PickList
            label={title[section.kind]}
            picked={picked}
            onToggle={toggle}
            lines={section.items.map((s) => {
              const staple = Boolean(products[s.key]?.staple);
              return {
                key: s.key,
                name: s.name,
                detail: [lineDetail(amountText(s), s.note), reasonText(s)].filter(Boolean).join(" · ") || null,
                trailing: (
                  <span className="flex shrink-0 items-center">
                    <button
                      type="button"
                      aria-pressed={staple}
                      aria-label={format(staple ? copy.stapleOffNamed : copy.stapleNamed, { name: s.name })}
                      onClick={() => void actions.setStaple(s.name, !staple)}
                      className={`flex size-11 items-center justify-center rounded-full ${staple ? "text-accent" : "text-label-tertiary"}`}
                    >
                      <Pin aria-hidden size={18} strokeWidth={2.25} fill={staple ? "currentColor" : "none"} />
                    </button>
                    <button
                      type="button"
                      aria-label={format(copy.dismissNamed, { name: s.name })}
                      onClick={() => void actions.dismiss(s.key, s.name)}
                      className="flex size-11 items-center justify-center rounded-full text-label-tertiary"
                    >
                      <X aria-hidden size={18} strokeWidth={2.25} />
                    </button>
                  </span>
                ),
              };
            })}
          />
        </section>
      ))}
      <p className="px-4 text-[13px] text-label-secondary">{copy.planHint}</p>
      <AddBar count={picked.size} onAdd={() => onAdd(suggestions.filter((s) => picked.has(s.key)).map(toNew))} />
    </>
  );
}

function GroupPicker({ group, onAdd, onEdit }: { group: ShoppingGroup; onAdd: (items: NewShoppingItem[]) => void; onEdit: () => void }) {
  const { dict } = useI18n();
  const shopping = useHousehold((s) => s.shopping);
  const amountText = useAmountText();
  const listed = new Set(shopping.filter((item) => !item.checkedAt).map((item) => itemKey(item.name)));
  const lines: PickLine[] = group.items.map((line, index) => ({
    key: `${index}-${itemKey(line.name)}`,
    name: line.name,
    detail: lineDetail(amountText(line), line.note),
    onList: listed.has(itemKey(line.name)),
  }));
  const [picked, toggle] = usePicked(() => notOnList(lines));
  return (
    <>
      <div className="flex items-center justify-between gap-3 px-1">
        <h3 dir="auto" className="min-w-0 truncate text-xl font-semibold tracking-tight">
          {group.name}
        </h3>
        <button type="button" onClick={onEdit} className="min-h-11 shrink-0 px-2 text-[17px] text-accent">
          {dict.shopping.groupEdit}
        </button>
      </div>
      <PickList label={group.name} lines={lines} picked={picked} onToggle={toggle} />
      <AddBar count={picked.size} onAdd={() => onAdd(group.items.filter((_, index) => picked.has(lines[index].key)).map(toNew))} />
    </>
  );
}

function GroupEditor({ group, onDone }: { group: ShoppingGroup | null; onDone: () => void }) {
  const { dict } = useI18n();
  const copy = dict.shopping;
  const shopping = useHousehold((s) => s.shopping);
  const saveGroup = useHousehold((s) => s.saveShoppingGroup);
  const deleteGroup = useHousehold((s) => s.deleteShoppingGroup);
  const actions = useShoppingActions();
  const amountText = useAmountText();
  const [name, setName] = useState(group?.name ?? "");
  const [text, setText] = useState(() =>
    (group?.items ?? []).map((line) => [amountText(line), line.name].filter(Boolean).join(" ") + (line.note ? `, ${line.note}` : "")).join("\n"),
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const known = (value: string) => knownAisle(value) !== null;
  const lines = text
    .split(/\r?\n/)
    .flatMap((row) => parseItems(row.split(",")[0] ?? "", known).slice(0, 1).map((item) => ({ item, note: row.split(",").slice(1).join(",").trim() || null })))
    .map(({ item, note }): GroupLine => ({ name: item.name, quantity: item.quantity, unit: item.unit, note }));
  const valid = name.trim().length > 0 && lines.length > 0;

  const save = async () => {
    if (!valid || busy) return;
    setBusy(true);
    const ok = await saveGroup({ id: group?.id ?? crypto.randomUUID(), name: name.trim(), items: lines.slice(0, 100) });
    setBusy(false);
    if (!ok) return actions.failed();
    onDone();
  };

  return (
    <>
      <div className={sheetGroup}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={copy.groupName}
          aria-label={copy.groupName}
          maxLength={60}
          className="h-12 w-full bg-transparent px-4 text-[17px] outline-none placeholder:text-label-tertiary"
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={copy.groupItemsPlaceholder}
          aria-label={copy.groupItems}
          rows={7}
          className="block w-full resize-none bg-transparent px-4 py-3 text-[17px] outline-none placeholder:text-label-tertiary"
        />
      </div>
      <p className="px-4 text-[13px] text-label-secondary">{copy.groupItemsHint}</p>
      {shopping.some((item) => !item.checkedAt) && (
        <button
          type="button"
          onClick={() =>
            setText(
              shopping
                .filter((item) => !item.checkedAt)
                .map((item) => [amountText(item), item.name].filter(Boolean).join(" ") + (item.note ? `, ${item.note}` : ""))
                .join("\n"),
            )
          }
          className="min-h-12 w-full rounded-xl bg-surface text-[17px] font-medium text-accent"
        >
          {copy.groupFromList}
        </button>
      )}
      <button
        type="button"
        onClick={() => void save()}
        disabled={!valid || busy}
        className="min-h-12 w-full rounded-xl bg-accent text-[17px] font-semibold text-accent-contrast disabled:opacity-40"
      >
        {copy.groupSave}
      </button>
      {group && (
        <button
          type="button"
          onClick={async () => {
            if (!confirmDelete) return setConfirmDelete(true);
            if (!(await deleteGroup(group.id))) return actions.failed();
            onDone();
          }}
          className="min-h-12 w-full rounded-xl text-[17px] font-semibold text-danger"
        >
          {confirmDelete ? dict.add.deleteConfirm : copy.groupDelete}
        </button>
      )}
    </>
  );
}

function GroupsTab({ view, go, onAdd }: { view: View; go: (view: View) => void; onAdd: (items: NewShoppingItem[]) => void }) {
  const { dict } = useI18n();
  const copy = dict.shopping;
  const groups = useHousehold((s) => s.groups);
  if ("group" in view) {
    const group = groups.find((known) => known.id === view.group);
    if (group) return <GroupPicker group={group} onAdd={onAdd} onEdit={() => go({ tab: "groups", edit: group.id })} />;
  }
  if ("edit" in view) {
    const group = view.edit === "new" ? null : (groups.find((known) => known.id === view.edit) ?? null);
    return <GroupEditor key={view.edit} group={group} onDone={() => go({ tab: "groups" })} />;
  }
  return (
    <>
      {groups.length === 0 ? (
        <p className="px-4 pt-2 text-[17px] text-label-secondary">{copy.groupEmpty}</p>
      ) : (
        <ul className={sheetGroup}>
          {groups.map((group) => (
            <li key={group.id}>
              <button
                type="button"
                onClick={() => go({ tab: "groups", group: group.id })}
                className="flex min-h-12 w-full items-center gap-3 px-4 text-start text-[17px]"
              >
                <span dir="auto" className="min-w-0 flex-1 truncate">
                  {group.name}
                </span>
                <span className="shrink-0 tabular-nums text-label-secondary">{format(copy.groupCount, { count: group.items.length })}</span>
                <ChevronLeft aria-hidden size={18} className="shrink-0 text-label-tertiary ltr:-scale-x-100" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={() => go({ tab: "groups", edit: "new" })}
        className="flex min-h-12 w-full items-center justify-center gap-1.5 rounded-xl bg-surface text-[17px] font-medium text-accent"
      >
        <Plus aria-hidden size={18} strokeWidth={2.5} />
        {copy.groupNew}
      </button>
    </>
  );
}

function TripView({ trip, onAdd }: { trip: ShoppingTrip; onAdd: (items: NewShoppingItem[]) => void }) {
  const { dict, locale } = useI18n();
  const copy = dict.shopping;
  const { shopping, members } = useHousehold();
  const actions = useShoppingActions();
  const amountText = useAmountText();
  const [confirmUndo, setConfirmUndo] = useState(false);
  const listed = new Set(shopping.filter((item) => !item.checkedAt).map((item) => itemKey(item.name)));
  const lines: PickLine[] = trip.items.map((line) => ({
    key: line.itemId || line.name,
    name: line.name,
    detail: lineDetail(amountText(line), line.note),
    onList: listed.has(itemKey(line.name)),
  }));
  const [picked, toggle] = usePicked(() => new Set());
  const who = members.find((member) => member.id === trip.finishedBy)?.name;
  const date = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }).format(new Date(trip.finishedAt));
  return (
    <>
      <div className="px-1">
        <h3 className="text-xl font-semibold tracking-tight">{date}</h3>
        <p className="text-[15px] text-label-secondary">
          {[who, trip.undoneAt ? copy.tripUndone : null].filter(Boolean).join(" · ")}
        </p>
      </div>
      <PickList label={date} lines={lines} picked={picked} onToggle={toggle} />
      {trip.missing.length > 0 && (
        <p className="px-4 text-[15px] text-label-secondary">{format(copy.tripMissing, { names: trip.missing.map((line) => line.name).join(", ") })}</p>
      )}
      <AddBar count={picked.size} onAdd={() => onAdd(trip.items.filter((line) => picked.has(line.itemId || line.name)).map(toNew))} />
      {!trip.undoneAt && (
        <button
          type="button"
          onClick={() => {
            if (!confirmUndo) return setConfirmUndo(true);
            actions.undoTrip(trip.id);
          }}
          className="min-h-12 w-full rounded-xl text-[17px] font-medium text-danger"
        >
          {confirmUndo ? copy.tripUndoConfirm : copy.tripUndo}
        </button>
      )}
    </>
  );
}

function HistoryTab({ view, go, onAdd }: { view: View; go: (view: View) => void; onAdd: (items: NewShoppingItem[]) => void }) {
  const { dict, locale } = useI18n();
  const copy = dict.shopping;
  const { trips, members } = useHousehold();
  if ("trip" in view) {
    const trip = trips.find((known) => known.id === view.trip);
    if (trip) return <TripView key={trip.id} trip={trip} onAdd={onAdd} />;
  }
  if (trips.length === 0) return <p className="px-4 pt-2 text-[17px] text-label-secondary">{copy.historyEmpty}</p>;
  const date = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short" });
  return (
    <ul className={sheetGroup}>
      {trips.map((trip) => (
        <li key={trip.id}>
          <button type="button" onClick={() => go({ tab: "history", trip: trip.id })} className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-start">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className={`text-[17px] ${trip.undoneAt ? "text-label-secondary line-through" : ""}`}>{date.format(new Date(trip.finishedAt))}</span>
              <span className="truncate text-[13px] text-label-secondary">
                {[
                  trip.items.length === 1 ? copy.finishedOne : format(copy.finishedCount, { count: trip.items.length }),
                  members.find((member) => member.id === trip.finishedBy)?.name,
                  trip.undoneAt ? copy.tripUndone : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
            <ChevronLeft aria-hidden size={18} className="shrink-0 text-label-tertiary ltr:-scale-x-100" />
          </button>
        </li>
      ))}
    </ul>
  );
}

function PlanContent({ onDone }: { onDone: () => void }) {
  const { dict } = useI18n();
  const copy = dict.shopping;
  const actions = useShoppingActions();
  const [view, go] = useState<View>({ tab: "suggest" });
  const deep = "group" in view || "edit" in view || "trip" in view;
  const add = (items: NewShoppingItem[]) => {
    if (items.length === 0) return;
    actions.addMany(items);
    onDone();
  };
  return (
    <>
      <SheetHeader title={copy.planTitle} cancel={dict.add.cancel} />
      <SheetBody>
        {deep ? (
          <button type="button" onClick={() => go({ tab: view.tab })} className="flex min-h-11 items-center gap-1 self-start text-[17px] text-accent">
            <ChevronLeft aria-hidden size={20} className="rtl:-scale-x-100" />
            {copy.planTabs[view.tab]}
          </button>
        ) : (
          <SegmentedControl
            label={copy.planTitle}
            value={view.tab}
            onChange={(tab) => go({ tab })}
            options={(["suggest", "groups", "history"] as const).map((value) => ({ value, label: copy.planTabs[value] }))}
          />
        )}
        {view.tab === "suggest" && <SuggestTab onAdd={add} />}
        {view.tab === "groups" && <GroupsTab view={view} go={go} onAdd={add} />}
        {view.tab === "history" && <HistoryTab view={view} go={go} onAdd={add} />}
      </SheetBody>
    </>
  );
}

/** Planning a shop, out of the way of the main list: staples and suggestions, saved groups, and past trips. */
export function PlanSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [session, setSession] = useState(0);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setSession((n) => n + 1);
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <PlanContent key={session} onDone={() => onOpenChange(false)} />
    </Sheet>
  );
}
