"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { CalendarDays, Moon, ShoppingBasket, Sunrise, Sunset } from "lucide-react";
import { HomieMark } from "@/components/brand/homie-mark";
import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
import { localeDirection } from "@/i18n/config";
import type { DayKey } from "@/lib/dates";
import { fromDayKey } from "@/lib/dates";
import { sortEvents } from "@/lib/household";
import { useHousehold } from "@/lib/household-store";
import { paintSky, skyAt } from "@/lib/sky";
import { nextSunEvent } from "@/lib/sun-times";

const vars = (values: Record<string, string>) => values as CSSProperties;

/** Fixed, so the stars don't jump between renders; seeded from their index. */
const stars = Array.from({ length: 26 }, (_, i) => {
  const r = (n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
  return { x: r(1) * 100, y: r(2) * 70, size: 1 + r(3) * 1.6, opacity: 0.45 + r(4) * 0.5 };
});

/** Where the cards hang around the house, as drawn for left-to-right; mirrored in Hebrew. */
const seats = [
  { x: 79, y: 14, tilt: 2.5, float: 7.1, drift: { x: -5, y: 10, lean: -1.2 } },
  { x: 21, y: 28, tilt: -3, float: 6.5, drift: { x: 5, y: 11, lean: 1.3 } },
  { x: 79, y: 72, tilt: 2, float: 7.6, drift: { x: -4, y: 9, lean: 1 } },
  { x: 21, y: 86, tilt: -2, float: 6.9, drift: { x: 5, y: 12, lean: -1.1 } },
];

/** A time picked with ?sky=05:40 or the preview slider; null follows the clock. */
let pinnedAt: number | null = null;
const pinListeners = new Set<() => void>();
const repin = (at: number | null) => {
  pinnedAt = at;
  pinListeners.forEach((listener) => listener());
};

function subscribeSky(onChange: () => void) {
  const timer = window.setInterval(onChange, 30_000);
  document.addEventListener("visibilitychange", onChange);
  pinListeners.add(onChange);
  return () => {
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", onChange);
    pinListeners.delete(onChange);
  };
}
// Steps of half a minute, so two reads in the same render agree.
const skySnapshot = () => pinnedAt ?? Math.floor(Date.now() / 30_000) * 30_000;
const subscribeNever = () => () => {};

/**
 * The moment the sky shows: now, every half minute. `?sky=05:40` pins a time and `?sky=preview`
 * adds a slider to walk through the day, for checking how each hour paints the stage.
 */
function useSkyTime() {
  const now = useSyncExternalStore(subscribeSky, skySnapshot, () => null);
  const preview = useSyncExternalStore(subscribeNever, () => new URLSearchParams(location.search).get("sky") === "preview", () => false);

  useEffect(() => {
    const [hours, minutes] = new URLSearchParams(location.search).get("sky")?.split(":").map(Number) ?? [];
    if (Number.isFinite(hours) && Number.isFinite(minutes)) repin(new Date().setHours(hours, minutes, 0, 0));
    return () => repin(null);
  }, []);

  // Before paint: after a client-side navigation the sky can be hours old, and must not show for a frame.
  useLayoutEffect(() => {
    if (now !== null) paintSky(skyAt(now));
  }, [now]);

  return { now, preview, pin: repin };
}

type Card = { id: string; href: string; label: string; title: string; note: string | null; visual: ReactNode };

/**
 * Today's head: the house under the sky of this very moment (dawn, noon, golden hour, dusk, night),
 * in the sign-in stage's language: rings and a halo around the Homie house, whose window lights in
 * the evening, and the day's next things floating around it.
 */
export function SkyStage({ today, openCount }: { today: DayKey | null; openCount: number }) {
  const { locale, dict } = useI18n();
  const rtl = localeDirection[locale] === "rtl";
  const { now, preview, pin } = useSkyTime();
  const { tasks, events, shopping, members } = useHousehold();
  const stage = useRef<HTMLDivElement>(null);

  // The loops stop while the stage is scrolled away or the app is in the background.
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    let offscreen = false;
    const sync = () => {
      if (offscreen || document.hidden) el.dataset.paused = "";
      else delete el.dataset.paused;
    };
    const observer = new IntersectionObserver(([entry]) => {
      offscreen = !entry.isIntersecting;
      sync();
    });
    observer.observe(el);
    document.addEventListener("visibilitychange", sync);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  const minuteKey = now === null ? null : Math.floor(now / 60_000);
  const sky = useMemo(() => (minuteKey === null ? null : skyAt(minuteKey * 60_000)), [minuteKey]);
  const sun = useMemo(() => (minuteKey === null ? null : nextSunEvent(minuteKey * 60_000)), [minuteKey]);
  const lit = sky ? Number(sky.vars["--sky-windows"]) > 0.5 : false;

  const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hour12: false });
  const relative = new Intl.RelativeTimeFormat(locale === "he" ? "he-IL" : "en-US", { numeric: "auto" });
  const until = (at: number) => {
    const minutes = Math.round((at - (now ?? at)) / 60_000);
    // Hebrew data repeats the count after singular and dual forms: "בעוד שעתיים (2)".
    const say = (value: number, unit: Intl.RelativeTimeFormatUnit) => relative.format(value, unit).replace(/\s\(\d+\)$/, "");
    return minutes < 60 ? say(Math.max(1, minutes), "minute") : say(Math.round(minutes / 60), "hour");
  };
  const firstName = (id: string) => members.find((m) => m.id === id)?.name.trim().split(/\s+/)[0] ?? null;

  const cards: Card[] = [];
  if (sun) {
    const night = sky ? sky.elevation < -6 : false;
    cards.push({
      id: "sun",
      href: `/${locale}`,
      label: format(sun.kind === "sunset" ? dict.sky.sunset : dict.sky.sunrise, { time: time.format(sun.at) }),
      title: format(sun.kind === "sunset" ? dict.sky.sunset : dict.sky.sunrise, { time: time.format(sun.at) }),
      note: until(sun.at),
      visual: (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-[color-mix(in_oklab,var(--sky-sun)_45%,var(--surface))] text-[#b4682c]">
          {night && sun.kind === "sunrise" ? <Moon size={17} strokeWidth={2.1} /> : sun.kind === "sunset" ? <Sunset size={17} strokeWidth={2.1} /> : <Sunrise size={17} strokeWidth={2.1} />}
        </span>
      ),
    });
  }
  if (today) {
    const next = tasks
      .filter((t) => !t.completedAt && t.dueDate && t.dueDate <= today)
      .sort((a, b) => ((a.dueDate ?? "") < (b.dueDate ?? "") ? -1 : 1))[0];
    const who = next ? firstName(next.assigneeId) : null;
    const assignee = next ? members.find((m) => m.id === next.assigneeId) : undefined;
    cards.push({
      id: next ? `task-${next.id}` : "task-none",
      href: `/${locale}/tasks`,
      label: next ? next.title : dict.sky.noTasks,
      title: next ? next.title : dict.sky.noTasks,
      note: next ? [who, next.dueDate && next.dueDate < today ? dict.today.overdue : dict.tasks.today].filter(Boolean).join(" · ") : dict.sky.calm,
      visual: (
        <span className="flex size-8 shrink-0 items-center justify-center">
          <span className="size-[22px] rounded-full border-2" style={{ borderColor: assignee?.color ?? "var(--green)" }} />
        </span>
      ),
    });
    const clock = now === null ? "00:00" : time.format(now);
    // Today's events that already happened are behind us; one without a time lasts all day.
    const upcoming = events
      .filter((e) => e.date > today || (e.date === today && (!e.time || e.time.slice(0, 5) >= clock)))
      .sort(sortEvents)[0];
    if (upcoming) {
      const day = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short" });
      const when = upcoming.date === today ? (upcoming.time ? upcoming.time.slice(0, 5) : dict.events.allDay) : day.format(fromDayKey(upcoming.date));
      cards.push({
        id: `event-${upcoming.id}`,
        href: `/${locale}/calendar`,
        label: upcoming.title,
        title: upcoming.title,
        note: when,
        visual: (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-[color-mix(in_oklab,var(--coral)_16%,var(--surface))] text-coral">
            <CalendarDays size={17} strokeWidth={2.1} />
          </span>
        ),
      });
    }
  }
  const toBuy = shopping.filter((item) => !item.checkedAt);
  if (toBuy.length > 0) {
    cards.push({
      id: "shopping",
      href: `/${locale}/shopping`,
      label: toBuy.length === 1 ? dict.sky.toBuyOne : format(dict.sky.toBuyMany, { count: toBuy.length }),
      title: toBuy.length === 1 ? dict.sky.toBuyOne : format(dict.sky.toBuyMany, { count: toBuy.length }),
      note: toBuy.slice(0, 2).map((item) => item.name).join(", "),
      visual: (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-[color-mix(in_oklab,var(--green)_14%,var(--surface))] text-green">
          <ShoppingBasket size={17} strokeWidth={2.1} />
        </span>
      ),
    });
  }

  const summary =
    openCount === 0 ? dict.today.houseCalm : openCount === 1 ? dict.today.summary.one : format(dict.today.summary.many, { count: openCount });

  return (
    <section aria-label={dict.today.houseTitle} className="relative">
      <div
        ref={stage}
        className="sky sky-stage relative isolate -mx-4 h-[20rem] overflow-hidden select-none [mask-image:linear-gradient(to_bottom,transparent,black_18%,black_90%,transparent)] md:mx-0"
      >
        {/* The sky of this moment, a wash that fades into the page instead of a framed picture. */}
        <div aria-hidden className="sky-stage-wash absolute inset-0 -z-10">
          <div className="sky-gradient absolute inset-0" />
          <div className="sky-glow" />
          <div className="sky-stars">
            {stars.map((star, i) => (
              <span
                key={i}
                className="sky-star"
                style={{ left: `${star.x}%`, top: `${star.y}%`, width: star.size, height: star.size, opacity: star.opacity }}
              />
            ))}
          </div>
          <div className="sky-sun" />
          <div className="sky-moon" />
          <div className="sky-dim" />
        </div>

        <div aria-hidden className="absolute left-1/2 top-[47%] size-0">
          {[0, 1, 2].map((ring) => (
            <span key={ring} className="door-ring-in absolute left-0 top-0 size-0" style={vars({ "--d": `${0.3 + ring * 0.1}s` })}>
              <span
                className="sky-stage-ring stage-ring absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ width: `${8 + ring * 6}rem`, height: `${8 + ring * 6}rem`, ...vars({ "--d": `${ring * 0.35}s` }) }}
              />
            </span>
          ))}
          <span className="door-fade-in absolute left-0 top-0 size-0" style={vars({ "--d": "0.6s" })}>
            <span className="stage-ripple absolute -left-[3.25rem] -top-[3.25rem] size-[6.5rem] rounded-full border-[1.5px] border-[color-mix(in_oklab,var(--scene-ink)_30%,transparent)]" />
          </span>
          <span className="door-fade-in absolute left-0 top-0 size-0" style={vars({ "--d": "0.2s" })}>
            <span className="sky-stage-halo door-breathe absolute left-0 top-0 size-[10.5rem] -translate-x-1/2 -translate-y-1/2 rounded-full" />
          </span>
          <div className="door-mark-in absolute left-0 top-0 z-10 -translate-x-1/2 -translate-y-1/2" style={vars({ "--d": "0.05s" })}>
            <HomieMark size={84} lit={lit} />
          </div>
        </div>
        <p className="sr-only">{summary}</p>

        {cards.slice(0, seats.length).map((card, index) => {
          const seat = seats[index];
          const x = rtl ? 100 - seat.x : seat.x;
          const arrive = 0.5 + index * 0.09;
          return (
            <div
              key={card.id}
              className="absolute transition-[left,top] duration-500 ease-[var(--ease-out-strong)]"
              style={{ left: `${x}%`, top: `${seat.y}%`, transform: `translate(-50%, -50%) rotate(${rtl ? -seat.tilt : seat.tilt}deg)` }}
            >
              <div
                className="door-float"
                style={vars({
                  "--float": `${seat.float}s`,
                  "--d": `${arrive + 0.85}s`,
                  "--ax": `${rtl ? -seat.drift.x : seat.drift.x}px`,
                  "--ay": `${seat.drift.y}px`,
                  "--ar": `${rtl ? -seat.drift.lean : seat.drift.lean}deg`,
                })}
              >
                <div className="door-sway">
                  <div
                    className="door-card-in"
                    style={vars({ "--d": `${arrive}s`, "--fx": `${Math.round((50 - x) * 0.6)}px`, "--fy": `${Math.round((47 - seat.y) * 0.6)}px` })}
                  >
                    <Link
                      href={card.href}
                      aria-label={card.note ? `${card.label}, ${card.note}` : card.label}
                      className="flex max-w-[9.5rem] items-center gap-2.5 rounded-[18px] bg-surface py-2 ps-2 pe-3.5 shadow-[0_1px_1px_rgb(40_30_20/0.04),0_14px_32px_-14px_rgb(20_20_40/0.35)] ring-1 ring-[light-dark(rgb(40_30_20/0.06),rgb(255_255_255/0.08))] transition-transform duration-150 ease-out active:scale-[0.96]"
                    >
                      {card.visual}
                      <span className="flex min-w-0 flex-col">
                        <span dir="auto" className="truncate text-[14px] font-semibold leading-[1.2] tracking-[-0.01em] text-label">
                          {card.title}
                        </span>
                        {card.note && <span className="mt-0.5 truncate text-[12px] leading-[1.2] text-label/[0.68]">{card.note}</span>}
                      </span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {preview && now !== null && <TimeSlider now={now} onPick={pin} label={dict.sky.preview} />}
    </section>
  );
}

/** Only with ?sky=preview: drag through the day to see how each hour paints the stage. */
function TimeSlider({ now, onPick, label }: { now: number; onPick: (at: number) => void; label: string }) {
  const date = new Date(now);
  const minutes = date.getHours() * 60 + date.getMinutes();
  return (
    <label className="mt-2 flex items-center gap-3 rounded-full bg-surface px-4 py-2 text-[13px] text-label-secondary shadow-card">
      <span className="shrink-0">{label}</span>
      <input
        type="range"
        min={0}
        max={1439}
        step={5}
        value={minutes}
        onChange={(event) => {
          const value = Number(event.target.value);
          onPick(new Date(now).setHours(Math.floor(value / 60), value % 60, 0, 0));
        }}
        className="min-w-0 flex-1 accent-[var(--accent)]"
      />
      <span className="w-11 shrink-0 text-end tabular-nums text-label">{`${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`}</span>
    </label>
  );
}
