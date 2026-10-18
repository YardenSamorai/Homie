"use client";

import { useRef, useState } from "react";
import { Drawer } from "@base-ui/react/drawer";
import { Avatar } from "@/components/ui/avatar";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/i18n/dictionary-provider";
import type { DayKey } from "@/lib/dates";
import { useAddSheet, useHousehold, type AddKind } from "@/lib/household-store";
import type { Recurrence } from "@/lib/tasks";
import { useClock } from "@/lib/use-clock";

const kinds: AddKind[] = ["task", "shopping", "event"];

const fieldClass =
  "h-12 w-full bg-transparent px-4 text-[17px] text-label outline-none placeholder:text-label-tertiary";
const groupClass = "overflow-hidden rounded-xl bg-surface divide-y divide-separator";
const rowClass = "flex min-h-12 items-center justify-between gap-3 px-4 text-[17px]";
const pickerClass =
  "rounded-lg bg-fill px-2.5 py-1.5 text-[17px] text-accent tabular-nums outline-none [color-scheme:inherit]";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="px-4 pb-1.5 text-[13px] uppercase text-label-secondary">{children}</p>;
}

function AddForm({ defaultDay, onDone }: { defaultDay: DayKey; onDone: () => void }) {
  const { dict } = useI18n();
  const kind = useAddSheet((s) => s.kind);
  const setKind = useAddSheet((s) => s.setKind);
  const { members, currentUserId, addTask, addShoppingItem, addEvent } = useHousehold();
  const titleRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [assigneeId, setAssigneeId] = useState(currentUserId);
  const [hasDate, setHasDate] = useState(true);
  const [date, setDate] = useState<DayKey>(defaultDay);
  const [recurrence, setRecurrence] = useState<Recurrence>("none");
  const [allDay, setAllDay] = useState(false);
  const [time, setTime] = useState("19:00");

  const valid = title.trim().length > 0 && (kind !== "event" || date !== "");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    const clean = title.trim();
    const extra = note.trim() || null;
    if (kind === "task") {
      const dueDate = hasDate && date ? date : null;
      addTask({ title: clean, assigneeId, dueDate, recurrence: dueDate ? recurrence : "none" });
    } else if (kind === "shopping") {
      addShoppingItem({ name: clean, note: extra });
    } else {
      addEvent({ title: clean, date, time: allDay ? null : time, prep: extra });
    }
    onDone();
  };

  const placeholder = { task: dict.add.taskTitle, shopping: dict.add.itemName, event: dict.add.eventTitle }[kind];

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <div className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center px-4 pb-3 pt-1">
        <Drawer.Close className="justify-self-start py-2 text-[17px] text-accent">{dict.add.cancel}</Drawer.Close>
        <Drawer.Title className="text-[17px] font-semibold">{dict.add.titles[kind]}</Drawer.Title>
        <button
          type="submit"
          disabled={!valid}
          className="justify-self-end py-2 text-[17px] font-semibold text-accent transition-opacity duration-150 disabled:opacity-35"
        >
          {dict.add.submit}
        </button>
      </div>

      <Drawer.Content className="flex min-h-0 flex-1 touch-auto flex-col gap-6 overflow-y-auto overscroll-contain px-4 pb-[max(env(safe-area-inset-bottom),20px)]">
        <SegmentedControl
          label={dict.add.open}
          value={kind}
          onChange={(next) => {
            setKind(next);
            titleRef.current?.focus();
          }}
          options={kinds.map((value) => ({ value, label: dict.add.kinds[value] }))}
        />

        <div className={groupClass}>
          <input
            ref={titleRef}
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            enterKeyHint="done"
            maxLength={120}
            className={fieldClass}
          />
          {kind === "shopping" && (
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={dict.add.itemNote}
              aria-label={dict.add.itemNote}
              maxLength={60}
              className={fieldClass}
            />
          )}
        </div>

        {kind === "task" && (
          <>
            <div>
              <SectionLabel>{dict.add.assignee}</SectionLabel>
              <div role="radiogroup" aria-label={dict.add.assignee} className="flex gap-2">
                {members.map((member) => {
                  const selected = member.id === assigneeId;
                  return (
                    <button
                      key={member.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setAssigneeId(member.id)}
                      style={selected ? { boxShadow: `inset 0 0 0 2px ${member.color}` } : undefined}
                      className="flex min-h-12 flex-1 items-center gap-2.5 rounded-xl bg-surface px-3 text-[17px] transition-[scale] duration-100 ease-out active:scale-[0.97]"
                    >
                      <Avatar member={member} size={28} />
                      <span className={selected ? "font-semibold" : undefined}>{member.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={groupClass}>
              <div className={rowClass}>
                <span className="me-auto">{dict.add.date}</span>
                {hasDate && (
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    aria-label={dict.add.date}
                    className={pickerClass}
                  />
                )}
                <Switch checked={hasDate} onChange={setHasDate} label={dict.add.date} />
              </div>
              {hasDate && (
                <>
                  <div className="flex flex-col gap-2 px-4 py-3">
                    <span className="text-[15px] text-label-secondary">{dict.add.repeat}</span>
                    <SegmentedControl
                      label={dict.add.repeat}
                      value={recurrence}
                      onChange={setRecurrence}
                      options={[
                        { value: "none", label: dict.add.repeatNone },
                        { value: "daily", label: dict.today.recurrence.daily },
                        { value: "weekly", label: dict.today.recurrence.weekly },
                      ]}
                    />
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {kind === "event" && (
          <>
            <div className={groupClass}>
              <label className={rowClass}>
                <span>{dict.add.date}</span>
                <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={pickerClass} />
              </label>
              <div className={rowClass}>
                <span>{dict.add.allDay}</span>
                <Switch checked={allDay} onChange={setAllDay} label={dict.add.allDay} />
              </div>
              {!allDay && (
                <label className={rowClass}>
                  <span>{dict.add.time}</span>
                  <input type="time" required value={time} onChange={(e) => setTime(e.target.value)} className={pickerClass} />
                </label>
              )}
            </div>
            <div>
              <SectionLabel>{dict.add.prep}</SectionLabel>
              <div className={groupClass}>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={dict.add.prepPlaceholder}
                  aria-label={dict.add.prep}
                  rows={3}
                  maxLength={300}
                  className="block w-full resize-none bg-transparent px-4 py-3 text-[17px] outline-none placeholder:text-label-tertiary"
                />
              </div>
            </div>
          </>
        )}
      </Drawer.Content>
    </form>
  );
}

export function AddSheet() {
  const { open, day, setOpen } = useAddSheet();
  const today = useClock()?.today;
  const seeded = useHousehold((s) => s.seeded);

  return (
    <Drawer.Root open={open && seeded} onOpenChange={setOpen}>
      <Drawer.VirtualKeyboardProvider>
        <Drawer.Portal>
          <Drawer.Backdrop className="fixed inset-0 z-50 min-h-dvh bg-black opacity-[calc(0.3*(1-var(--drawer-swipe-progress)))] transition-opacity duration-[450ms] ease-[var(--ease-ios)] data-swiping:duration-0 data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)]" />
          <Drawer.Viewport className="fixed inset-0 z-50 flex touch-none items-end justify-center">
            <Drawer.Popup className="flex max-h-[calc(100dvh-3rem)] min-h-[60dvh] w-full max-w-lg touch-none flex-col rounded-t-[28px] bg-sheet text-label shadow-[0_-8px_40px_rgb(40_30_20/0.16)] outline-none [transform:translateY(var(--drawer-swipe-movement-y))] transition-transform duration-[450ms] ease-[var(--ease-ios)] will-change-transform data-swiping:select-none data-starting-style:[transform:translateY(100%)] data-ending-style:[transform:translateY(100%)] data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] motion-reduce:transition-opacity motion-reduce:data-starting-style:[transform:none] motion-reduce:data-starting-style:opacity-0 motion-reduce:data-ending-style:[transform:none] motion-reduce:data-ending-style:opacity-0">
              <div aria-hidden className="mx-auto mb-1 mt-2 h-[5px] w-9 shrink-0 rounded-full bg-label-tertiary" />
              {today && <AddForm defaultDay={day ?? today} onDone={() => setOpen(false)} />}
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.VirtualKeyboardProvider>
    </Drawer.Root>
  );
}
