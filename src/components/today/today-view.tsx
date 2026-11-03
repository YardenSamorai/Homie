"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { ChevronLeft, Palette, SlidersHorizontal } from "lucide-react";
import { format } from "@/i18n/format";
import { useIncomingShare } from "@/lib/supabase/look-shares";
import { defaultHomeLayout, type HomeRegion } from "@/lib/home-layout";
import { usePrefs, usePrefsOf } from "@/lib/prefs-store";
import { addDays, fromDayKey } from "@/lib/dates";
import { agendaFor, concernsViewer, foldBusy, happeningNow, pickForToday, stillOn } from "@/lib/agenda";
import { useHousehold, useSelectedDay } from "@/lib/household-store";
import { noteShows, useCalendarItems, useHouseNote } from "@/lib/house-stores";
import { useAuth } from "@/lib/auth/session";
import { firstName, summarizeToday } from "@/lib/day-story";
import { periodFor } from "@/lib/period";
import { tasksOfDay, type Task } from "@/lib/tasks";
import { useClock, useMinuteClock } from "@/lib/use-clock";
import { useI18n } from "@/i18n/dictionary-provider";
import { ActivityBell } from "@/components/shell/activity";
import { UndoToast } from "@/components/ui/undo-toast";
import { DayTasks } from "./day-tasks";
import { HomeLayoutSheet } from "./home-layout-sheet";
import { HouseholdMembers } from "./household-members";
import { NoteCard, NoteSheet, PinNoteButton } from "./house-note";
import { RecentActivity } from "./recent-activity";
import { ShoppingGlance } from "./shopping-glance";
import { TodayAgenda } from "./today-agenda";
import { TomorrowPrep } from "./tomorrow-prep";

/** Rows "later today" has room for before the rest waits in the calendar. */
const AGENDA_LIMIT = 4;

/** Bold the count and the time inside the day's sentence, the way the rest stays quiet. */
function StoryLine({ text, marks }: { text: string; marks: string[] }) {
  const parts: Array<string | { mark: string }> = [];
  let rest = text;
  for (const mark of marks) {
    const at = rest.indexOf(mark);
    if (at < 0) continue;
    if (at > 0) parts.push(rest.slice(0, at));
    parts.push({ mark });
    rest = rest.slice(at + mark.length);
  }
  if (rest) parts.push(rest);
  return (
    <p className="mt-3 text-[20px] font-medium leading-[1.45] text-pretty text-label/65 first-letter:uppercase">
      {parts.map((part, index) =>
        typeof part === "string" ? (
          <span key={index}>{part}</span>
        ) : (
          <span key={index} className="font-bold text-label">
            {part.mark}
          </span>
        ),
      )}
    </p>
  );
}

/** A region with nothing to show, kept in place by a parent who turned off hiding empty regions. */
function EmptyRegion({ region }: { region: HomeRegion }) {
  const { dict } = useI18n();
  return (
    <section aria-label={dict.homeLayout.regions[region]} className="rounded-card px-4 py-3 ring-1 ring-separator">
      <p className="text-[15px] font-semibold text-label-secondary">{dict.homeLayout.regions[region]}</p>
      <p className="text-[14px] leading-snug text-label-tertiary">{dict.homeLayout.empty[region]}</p>
    </section>
  );
}

/**
 * Home is today: a sentence, the note, the people, what's still coming, then the list, in the order this parent
 * chose (src/lib/home-layout.ts).
 * Another day lives in the calendar. Sections with nothing to say aren't drawn. The greeting does not animate.
 */
export function TodayView() {
  const { locale, dict } = useI18n();
  const clock = useClock();
  const minuteClock = useMinuteClock();
  const today = clock?.today ?? null;
  const { currentUserId, members, tasks, events, shopping, toggleTask } = useHousehold();
  const userId = useAuth((s) => s.session?.userId ?? null);
  const householdId = useAuth((s) => s.session?.householdId ?? null);
  const owner = userId && householdId ? `${userId}:${householdId}` : null;
  const note = useHouseNote((s) => (s.owner === owner ? s.note : null));
  const calendar = useCalendarItems((s) => (s.owner === owner ? s.items : null));
  const calendarFailed = useCalendarItems((s) => s.status === "failed");
  const setSharedDay = useSelectedDay((s) => s.setDay);
  const currentUser = members.find((member) => member.id === currentUserId) ?? members[0];
  const selfId = currentUser?.id ?? "";
  const [toast, setToast] = useState<{ id: string; title: string } | null>(null);
  const [arranging, setArranging] = useState(false);
  const { share } = useIncomingShare();
  const layout = usePrefsOf(userId, (prefs) => prefs.home);
  const updatePrefs = usePrefs((s) => s.update);
  const shown = layout.order.filter((region) => !layout.hidden.includes(region));

  useEffect(() => {
    setSharedDay(today);
    return () => setSharedDay(null);
  }, [today, setSharedDay]);

  const dismissToast = useCallback(() => setToast(null), []);
  const period = clock && clock.hour != null ? periodFor(clock.hour) : null;
  const greeting = period ? dict.today.greeting[period] : "";
  const dateLine = today
    ? new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }).format(fromDayKey(today))
    : "";

  const toggle = (task: Task) => {
    if (!today) return;
    setToast(task.completedAt ? null : { id: task.id, title: task.title });
    toggleTask(task, today);
  };
  const undo = (id: string) => {
    const task = useHousehold.getState().tasks.find((t) => t.id === id);
    if (task?.completedAt && today) toggleTask(task, today);
    setToast(null);
  };

  const items = calendar ?? [];
  const minutes = minuteClock && minuteClock.today === today ? minuteClock.minutes : 0;
  const ofDay = today ? tasksOfDay(tasks, today, today) : null;
  const ahead = today ? foldBusy(agendaFor(today, events, items)).filter((entry) => stillOn(entry, minutes)) : [];
  const next = ahead.find((entry) => !entry.allDay && concernsViewer(entry, selfId)) ?? null;
  const agenda = pickForToday(ahead, selfId, AGENDA_LIMIT);
  const tomorrow = today ? agendaFor(addDays(today, 1), events, items) : [];
  const toBuy = shopping.filter((item) => !item.checkedAt).length;
  const story = ofDay
    ? summarizeToday({
        open: ofDay.open.length,
        done: ofDay.done.length,
        next: next
          ? { start: next.continues ? null : next.startLabel, end: next.kind === "calendar" ? next.endLabel : null, now: happeningNow(next, minutes) }
          : null,
        shopping: toBuy,
        copy: dict.today,
      })
    : null;
  const pinned = noteShows(note, today) ? note : null;

  return (
    <div className="relative isolate flex flex-col gap-stack pt-3 md:pt-10">
      <AnimatePresence initial={false}>
        {period && (
          <motion.div
            key={period}
            aria-hidden
            data-period={period}
            className="atmosphere"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: "easeInOut" }}
          />
        )}
      </AnimatePresence>

      <header>
        <div className="flex items-center justify-between gap-3">
          <p className="text-[14px] font-semibold text-label/60 first-letter:uppercase">{dateLine || "\u00a0"}</p>
          <div className="flex items-center gap-2">
            {today && householdId && !pinned && shown.includes("note") && <PinNoteButton />}
            <ActivityBell glass />
          </div>
        </div>
        <h1 className="mt-1 text-balance text-[clamp(2.15rem,9.2vw,2.25rem)] font-bold leading-[1.08] tracking-[-0.025em] [overflow-wrap:anywhere]">
          {currentUser ? (
            <>
              {greeting}, <bdi>{firstName(currentUser.name)}</bdi>
            </>
          ) : (
            greeting || "\u00a0"
          )}
        </h1>
        {story && <StoryLine text={story.text} marks={story.marks} />}
      </header>

      {share && (
        <Link
          href={`/${locale}/settings/appearance`}
          className="flex min-h-12 items-center gap-3 rounded-card bg-surface px-4 py-row shadow-card transition-colors duration-150 active:bg-fill"
        >
          <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-fill text-accent">
            <Palette size={17} />
          </span>
          <span className="min-w-0 flex-1 text-[15px] leading-snug">
            {format(dict.share.todayBanner, { name: firstName(members.find((member) => member.id === share.from)?.name ?? dict.share.partnerFallback) })}
          </span>
          <ChevronLeft aria-hidden size={18} className="shrink-0 text-label-tertiary ltr:-scale-x-100" />
        </Link>
      )}

      {shown.length === 0 && (
        <section className="flex flex-col items-start gap-2 rounded-card bg-surface p-5 shadow-card">
          <h2 className="text-[17px] font-semibold">{dict.homeLayout.allHidden}</h2>
          <p className="text-[15px] leading-snug text-label-secondary">{dict.homeLayout.allHiddenBody}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => setArranging(true)}
              className="min-h-11 rounded-full bg-accent px-4 text-[15px] font-semibold text-accent-contrast transition-transform duration-150 ease-out active:scale-[0.97]"
            >
              {dict.homeLayout.open}
            </button>
            <button
              type="button"
              onClick={() => void updatePrefs(userId ?? "", "home", defaultHomeLayout)}
              className="min-h-11 rounded-full bg-fill px-4 text-[15px] font-semibold transition-transform duration-150 ease-out active:scale-[0.97]"
            >
              {dict.homeLayout.restore}
            </button>
          </div>
        </section>
      )}

      {shown.map((region) => {
        const compact = layout.compact.includes(region);
        const empty = layout.hideEmpty ? null : <EmptyRegion region={region} />;
        switch (region) {
          case "note":
            return pinned && today ? <NoteCard key={region} note={pinned} today={today} /> : today ? <Fragment key={region}>{empty}</Fragment> : null;
          case "members":
            return members.length > 0 ? (
              <HouseholdMembers key={region} members={members} self={selfId} tasks={tasks} today={today} canInvite={members.length < 2 && householdId != null} />
            ) : null;
          case "agenda":
            return today && ofDay ? (
              <TodayAgenda key={region} entries={agenda.shown} hidden={agenda.hidden} stale={calendarFailed && items.length > 0} compact={compact} fallback={empty} />
            ) : null;
          case "tasks":
            return today && ofDay ? <DayTasks key={region} day={today} previousDay={today} today={today} tasks={tasks} members={members} onToggle={toggle} /> : null;
          case "shopping":
            return today ? <ShoppingGlance key={region} items={shopping} compact={compact} fallback={empty} /> : null;
          case "tomorrow":
            return today ? <TomorrowPrep key={region} entries={tomorrow} compact={compact} fallback={empty} /> : null;
          case "activity":
            return today && selfId ? <RecentActivity key={region} selfId={selfId} today={today} compact={compact} fallback={empty} /> : null;
        }
      })}
      {!(today && ofDay) && <div aria-hidden className="h-[240px]" />}

      {today && (
        <button
          type="button"
          onClick={() => setArranging(true)}
          className="flex min-h-11 items-center gap-2 self-center rounded-full px-4 text-[15px] font-medium text-label-secondary transition-colors duration-150 active:bg-fill"
        >
          <SlidersHorizontal aria-hidden size={16} />
          {dict.homeLayout.open}
        </button>
      )}
      <HomeLayoutSheet open={arranging} onOpenChange={setArranging} />

      <NoteSheet today={today} />
      <UndoToast toast={toast} label={dict.today.markedDone} undoLabel={dict.today.undo} onUndo={undo} onDismiss={dismissToast} />
    </div>
  );
}
