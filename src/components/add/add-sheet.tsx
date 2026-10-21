"use client";

import { useRef, useState } from "react";
import { Drawer } from "@base-ui/react/drawer";
import { Avatar } from "@/components/ui/avatar";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/i18n/dictionary-provider";
import type { DayKey } from "@/lib/dates";
import { useAddSheet, useHousehold, type AddKind } from "@/lib/household-store";
import { usePrefs } from "@/lib/prefs-store";
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
  const editing = useAddSheet((s) => s.edit);
  const {
    members,
    currentUserId,
    tasks,
    shopping,
    events,
    addTask,
    updateTask,
    deleteTask,
    addShoppingItem,
    updateShoppingItem,
    deleteShoppingItem,
    addEvent,
    updateEvent,
    deleteEvent,
  } = useHousehold();
  const titleRef = useRef<HTMLInputElement>(null);
  const seed =
    editing?.kind === "task"
      ? tasks.find((task) => task.id === editing.id)
      : editing?.kind === "shopping"
        ? shopping.find((item) => item.id === editing.id)
        : editing?.kind === "event"
          ? events.find((event) => event.id === editing.id)
          : undefined;

  const [title, setTitle] = useState(() => {
    if (!seed) return "";
    return "title" in seed ? seed.title : seed.name;
  });
  const [note, setNote] = useState(() => {
    if (!seed) return "";
    if ("note" in seed) return seed.note ?? "";
    if ("prep" in seed) return seed.prep ?? "";
    return "";
  });
  const newTask = usePrefs((s) => s.prefs.newTask);
  const [assigneeId, setAssigneeId] = useState(() => {
    if (seed && "assigneeId" in seed) return seed.assigneeId;
    const partner = members.find((member) => member.id !== currentUserId);
    return newTask.assignee === "partner" && partner ? partner.id : currentUserId;
  });
  const [hasDate, setHasDate] = useState(() => (seed && "dueDate" in seed ? Boolean(seed.dueDate) : newTask.due === "today"));
  const [date, setDate] = useState<DayKey>(() => {
    if (seed && "dueDate" in seed && seed.dueDate) return seed.dueDate;
    if (seed && "date" in seed) return seed.date;
    return defaultDay;
  });
  const [recurrence, setRecurrence] = useState<Recurrence>(() => (seed && "recurrence" in seed ? seed.recurrence : "none"));
  const [allDay, setAllDay] = useState(() => (seed && "time" in seed ? seed.time === null : false));
  const [time, setTime] = useState(() => (seed && "time" in seed && seed.time ? seed.time : "19:00"));
  const [confirmDelete, setConfirmDelete] = useState(false);

  const valid = title.trim().length > 0 && (kind !== "event" || date !== "");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    const clean = title.trim();
    const extra = note.trim() || null;
    if (kind === "task") {
      const dueDate = hasDate && date ? date : null;
      const next = { title: clean, assigneeId, dueDate, recurrence: dueDate ? recurrence : "none" as Recurrence };
      if (editing?.kind === "task") updateTask(editing.id, next);
      else addTask(next);
    } else if (kind === "shopping") {
      if (editing?.kind === "shopping") updateShoppingItem(editing.id, { name: clean, note: extra });
      else addShoppingItem({ name: clean, note: extra });
    } else if (editing?.kind === "event") {
      updateEvent(editing.id, { title: clean, date, time: allDay ? null : time, prep: extra });
    } else {
      addEvent({ title: clean, date, time: allDay ? null : time, prep: extra });
    }
    onDone();
  };

  const remove = () => {
    if (!editing) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    if (editing.kind === "task") deleteTask(editing.id);
    else if (editing.kind === "shopping") deleteShoppingItem(editing.id);
    else deleteEvent(editing.id);
    onDone();
  };

  const placeholder = { task: dict.add.taskTitle, shopping: dict.add.itemName, event: dict.add.eventTitle }[kind];
  const heading = editing ? dict.add.editTitles[kind] : dict.add.titles[kind];

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <div className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center px-4 pb-3 pt-1">
        <Drawer.Close className="justify-self-start py-2 text-[17px] text-accent">{dict.add.cancel}</Drawer.Close>
        <Drawer.Title className="text-[17px] font-semibold">{heading}</Drawer.Title>
        <button
          type="submit"
          disabled={!valid}
          className="justify-self-end py-2 text-[17px] font-semibold text-accent transition-opacity duration-150 disabled:opacity-35"
        >
          {editing ? dict.add.save : dict.add.submit}
        </button>
      </div>

      <Drawer.Content className="flex min-h-0 flex-1 touch-auto flex-col gap-6 overflow-y-auto overscroll-contain px-4 pb-[max(var(--safe-bottom),20px)]">
        {!editing && (
          <SegmentedControl
            label={dict.add.open}
            value={kind}
            onChange={(next) => {
              setKind(next);
              titleRef.current?.focus();
            }}
            options={kinds.map((value) => ({ value, label: dict.add.kinds[value] }))}
          />
        )}

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

        {editing && (
          <button
            type="button"
            onClick={remove}
            className="min-h-12 w-full rounded-xl text-[17px] font-semibold text-danger transition-transform duration-150 ease-out active:scale-[0.97]"
          >
            {confirmDelete ? dict.add.deleteConfirm : dict.add.delete}
          </button>
        )}
      </Drawer.Content>
    </form>
  );
}

export function AddSheet() {
  const { open, day, edit, setOpen } = useAddSheet();
  const today = useClock()?.today;
  return (
    <Drawer.Root open={open} onOpenChange={setOpen}>
      <Drawer.VirtualKeyboardProvider>
        <Drawer.Portal>
          <Drawer.Backdrop className="fixed inset-0 z-50 min-h-dvh bg-black opacity-[calc(0.3*(1-var(--drawer-swipe-progress)))] transition-opacity duration-[450ms] ease-[var(--ease-ios)] data-swiping:duration-0 data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)]" />
          <Drawer.Viewport className="fixed inset-0 z-50 flex touch-none items-end justify-center">
            <Drawer.Popup
              data-keyboard-aware
              className="relative flex max-h-[calc(100dvh_-_3rem_-_var(--keyboard))] min-h-[min(60dvh,calc(100dvh_-_3rem_-_var(--keyboard)))] w-full max-w-lg touch-none flex-col rounded-t-[28px] bg-sheet text-label shadow-[0_-8px_40px_rgb(40_30_20/0.16)] outline-none [transform:translateY(calc(var(--drawer-swipe-movement-y,0px)_-_var(--keyboard)))] transition-[transform,min-height,max-height] duration-[450ms] after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-dvh after:bg-sheet ease-[var(--ease-ios)] will-change-transform data-swiping:select-none data-starting-style:[transform:translateY(100%)] data-ending-style:[transform:translateY(100%)] data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] motion-reduce:transition-opacity motion-reduce:data-starting-style:[transform:none] motion-reduce:data-starting-style:opacity-0 motion-reduce:data-ending-style:[transform:none] motion-reduce:data-ending-style:opacity-0">
              <div aria-hidden className="mx-auto mb-1 mt-2 h-[5px] w-9 shrink-0 rounded-full bg-label-tertiary" />
              {today && (
                <AddForm key={edit ? `${edit.kind}-${edit.id}` : "new"} defaultDay={day ?? today} onDone={() => setOpen(false)} />
              )}
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.VirtualKeyboardProvider>
    </Drawer.Root>
  );
}
