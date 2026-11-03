"use client";

import { useState } from "react";
import { create } from "zustand";
import { Pin } from "lucide-react";
import { useAgo } from "@/components/shell/activity";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Sheet, SheetBody, SheetHeader } from "@/components/ui/sheet";
import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
import { useAuth } from "@/lib/auth/session";
import { addDays, fromDayKey, type DayKey } from "@/lib/dates";
import { firstName } from "@/lib/day-story";
import { useHouseNote } from "@/lib/house-stores";
import { useHousehold } from "@/lib/household-store";
import { supabaseConfigured } from "@/lib/supabase/env";
import { clearNote, loadNote, pinNote, type HouseNote, type NoteFailure } from "@/lib/supabase/house-extras";

const NOTE_MAX = 280;

export const useNoteSheet = create<{ open: boolean; show: () => void; hide: () => void }>()((set) => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}));

function useUntilLabel() {
  const { locale, dict } = useI18n();
  return (until: DayKey | null, today: DayKey) => {
    if (until === null) return null;
    if (until === today) return dict.note.untilToday;
    const day = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "numeric" }).format(fromDayKey(until));
    return format(dict.note.untilDay, { day });
  };
}

/** The house's one pinned note, quiet at the top of Today: who left it, when, and how long it stays. */
export function NoteCard({ note, today }: { note: HouseNote; today: DayKey }) {
  const { dict } = useI18n();
  const show = useNoteSheet((s) => s.show);
  const author = useHousehold((s) => s.members.find((member) => member.id === note.authorId));
  const ago = useAgo();
  const until = useUntilLabel()(note.until, today);

  return (
    <button
      type="button"
      onClick={show}
      aria-label={format(dict.note.editLabel, { body: note.body })}
      className="flex w-full items-start gap-3 rounded-card bg-[color-mix(in_oklab,var(--orange)_9%,var(--surface))] p-4 text-start ring-1 ring-[color-mix(in_oklab,var(--orange)_22%,transparent)] transition-transform duration-150 ease-out active:scale-[0.99]"
    >
      <Pin aria-hidden size={17} strokeWidth={2.25} className="mt-0.5 shrink-0 text-orange rtl:-scale-x-100" />
      <span className="min-w-0 flex-1">
        <span dir="auto" className="align-ui block whitespace-pre-line text-[17px] font-medium leading-snug [overflow-wrap:anywhere]">
          {note.body}
        </span>
        <span className="mt-1 block text-[13px] text-label-secondary">
          {author && <bdi>{firstName(author.name)}</bdi>}
          {author && " · "}
          {ago(note.updatedAt)}
          {until && ` · ${until}`}
        </span>
      </span>
    </button>
  );
}

/** Header button for a house with no note yet. */
export function PinNoteButton() {
  const { dict } = useI18n();
  const show = useNoteSheet((s) => s.show);
  return (
    <button
      type="button"
      onClick={show}
      aria-label={dict.note.add}
      className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/55 text-label backdrop-blur-xl transition-[scale] duration-150 ease-out active:scale-95"
    >
      <Pin aria-hidden size={19} strokeWidth={1.75} className="rtl:-scale-x-100" />
    </button>
  );
}

type Lasting = "today" | "day" | "open";

function NoteForm({ today, onDone }: { today: DayKey; onDone: () => void }) {
  const { dict } = useI18n();
  const copy = dict.note;
  const userId = useAuth((s) => s.session?.userId ?? null);
  const householdId = useAuth((s) => s.session?.householdId ?? null);
  const members = useHousehold((s) => s.members);
  const note = useHouseNote((s) => s.note);
  const [started] = useState(note);
  const [body, setBody] = useState(note?.body ?? "");
  const [lasting, setLasting] = useState<Lasting>(() => (note ? (note.until === null ? "open" : note.until === today ? "today" : "day") : "today"));
  const [day, setDay] = useState<DayKey>(() => (note?.until && note.until !== today ? note.until : addDays(today, 1)));
  // The note the save is allowed to replace: the one on screen when editing began, or a newer one the parent was shown.
  const [base, setBase] = useState<HouseNote | null>(note);
  const [failure, setFailure] = useState<NoteFailure | null>(null);
  const [newer, setNewer] = useState<HouseNote | null>(null);
  const [busy, setBusy] = useState(false);
  const owner = userId && householdId ? `${userId}:${householdId}` : null;
  const until = lasting === "today" ? today : lasting === "day" ? day : null;
  const valid = body.trim().length > 0 && (lasting !== "day" || (day !== "" && day >= today));

  const refresh = async () => {
    if (!householdId || !owner) return null;
    const fresh = await loadNote(householdId).catch(() => undefined);
    if (fresh !== undefined) useHouseNote.getState().set(owner, fresh);
    return fresh ?? null;
  };

  const save = async () => {
    if (!valid || !owner || !userId) return;
    setBusy(true);
    setFailure(null);
    if (!supabaseConfigured()) {
      useHouseNote.getState().set(owner, {
        body: body.trim(),
        authorId: userId,
        until,
        version: String(Date.now()),
        updatedAt: new Date().toISOString(),
      });
      onDone();
      return;
    }
    const result = await pinNote(body.trim(), until, base?.version ?? null);
    setBusy(false);
    if (typeof result !== "string") {
      useHouseNote.getState().set(owner, result);
      onDone();
      return;
    }
    setFailure(result);
    if (result === "stale") {
      const fresh = await refresh();
      setNewer(fresh);
      setBase(fresh);
    } else if (result === "gone") {
      await refresh();
      setNewer(null);
      setBase(null);
    }
  };

  const remove = async () => {
    if (!started || !owner) return;
    setBusy(true);
    setFailure(null);
    if (!supabaseConfigured()) {
      useHouseNote.getState().set(owner, null);
      onDone();
      return;
    }
    const result = await clearNote(base?.version ?? started.version);
    setBusy(false);
    if (result === true) {
      useHouseNote.getState().set(owner, null);
      onDone();
      return;
    }
    setFailure(result);
    if (result === "stale") {
      const fresh = await refresh();
      setNewer(fresh);
      setBase(fresh);
    }
  };

  const newerBy = newer ? members.find((member) => member.id === newer.authorId) : undefined;
  const message =
    failure === "stale"
      ? newer
        ? format(copy.stale, { name: newerBy ? firstName(newerBy.name) : copy.someone })
        : copy.staleGone
      : failure === "gone"
        ? copy.gone
        : failure === "past"
          ? copy.past
          : failure === "offline"
            ? copy.offline
            : failure
              ? copy.failed
              : null;

  return (
    <>
      <SheetHeader
        title={started ? copy.editTitle : copy.newTitle}
        cancel={dict.add.cancel}
        action={{ label: failure === "stale" && newer ? copy.replace : copy.pin, onClick: () => void save(), disabled: !valid || busy }}
      />
      <SheetBody>
        <div>
          <textarea
            dir="auto"
            rows={3}
            maxLength={NOTE_MAX}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={copy.placeholder}
            aria-label={copy.newTitle}
            autoFocus={!started}
            className="w-full resize-none rounded-xl bg-surface px-4 py-3 text-[17px] leading-snug outline-none placeholder:text-label-tertiary focus-visible:ring-2 focus-visible:ring-accent"
          />
          <p className="px-4 pt-1 text-end text-[13px] tabular-nums text-label-tertiary">
            {body.trim().length}/{NOTE_MAX}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <span className="px-4 text-[13px] font-medium text-label-secondary">{copy.lasting}</span>
          <SegmentedControl
            label={copy.lasting}
            value={lasting}
            onChange={setLasting}
            options={[
              { value: "today", label: copy.lastToday },
              { value: "day", label: copy.lastDay },
              { value: "open", label: copy.lastOpen },
            ]}
          />
          {lasting === "day" && (
            <label className="flex min-h-12 items-center justify-between gap-3 rounded-xl bg-surface px-4">
              <span className="text-[17px]">{copy.lastDayPick}</span>
              <input
                type="date"
                required
                min={today}
                value={day}
                onChange={(e) => setDay(e.target.value)}
                className="min-h-9 rounded-lg bg-fill px-2 text-[16px] text-label"
              />
            </label>
          )}
        </div>

        {message && (
          <div role="alert" className="rounded-xl bg-fill px-4 py-3 text-[15px] leading-snug">
            <p>{message}</p>
            {failure === "stale" && newer && (
              <p dir="auto" className="align-ui mt-1.5 text-label-secondary [overflow-wrap:anywhere]">
                “{newer.body}”
              </p>
            )}
          </div>
        )}

        {started && (
          <button
            type="button"
            onClick={() => void remove()}
            disabled={busy}
            className="min-h-12 rounded-xl bg-surface px-4 text-start text-[17px] text-danger transition-colors duration-150 active:bg-fill disabled:opacity-40"
          >
            {copy.remove}
          </button>
        )}
        <p className="px-4 text-[13px] leading-snug text-label-secondary">{copy.hint}</p>
      </SheetBody>
    </>
  );
}

export function NoteSheet({ today }: { today: DayKey | null }) {
  const open = useNoteSheet((s) => s.open);
  const hide = useNoteSheet((s) => s.hide);
  const [session, setSession] = useState(0);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setSession((n) => n + 1);
  }
  return (
    <Sheet open={open} onOpenChange={(next) => !next && hide()}>
      {today && <NoteForm key={session} today={today} onDone={hide} />}
    </Sheet>
  );
}
