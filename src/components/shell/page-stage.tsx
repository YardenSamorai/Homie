"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { LucideIcon } from "lucide-react";
import { easeOut } from "@/lib/motion";
import { useI18n } from "@/i18n/dictionary-provider";
import { localeDirection } from "@/i18n/config";

export type StageChip = { id: string; title: string; note?: string | null; visual: ReactNode };

/** Where the cards hang around the center, as drawn for left-to-right; mirrored in Hebrew. */
const seats = [
  { x: 24, y: 19, tilt: -3, float: 6.4, drift: { x: 5, y: 10, lean: 1.2 } },
  { x: 80, y: 34, tilt: 2.5, float: 7.3, drift: { x: -6, y: 12, lean: -1.4 } },
  { x: 73, y: 81, tilt: 2, float: 6.9, drift: { x: 4, y: 9, lean: 1 } },
  { x: 22, y: 72, tilt: -2, float: 7.8, drift: { x: -5, y: 11, lean: -1.1 } },
];

const vars = (values: Record<string, string>) => values as CSSProperties;

/**
 * The sign-in stage, at the head of a list: rings and a glow around the list's icon, and its next items
 * floating as cards. A new item rises out of the center; one that's done drifts away.
 */
export function PageStage({
  icon: Icon,
  tint,
  count,
  chips,
}: {
  icon: LucideIcon;
  /** The icon tile's gradient, top to bottom. */
  tint: [string, string];
  count: number;
  chips: StageChip[];
}) {
  const { locale } = useI18n();
  const rtl = localeDirection[locale] === "rtl";
  const stage = useRef<HTMLDivElement>(null);
  // Cards already there on first paint arrive one after another; later ones come at once.
  const [first, setFirst] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setFirst(false), 1500);
    return () => window.clearTimeout(timer);
  }, []);

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

  return (
    <div
      ref={stage}
      aria-hidden
      className="page-stage relative isolate -mx-4 h-[15.5rem] overflow-hidden select-none [mask-image:linear-gradient(to_bottom,transparent,black_14%,black_86%,transparent)] md:mx-0"
    >
      <div className="door-glow absolute inset-0 -z-10" />

      {/* No stacking context here: the icon (z-10) sits above the cards, the rings stay under them. */}
      <div className="absolute left-1/2 top-1/2 size-0">
        {[0, 1, 2].map((ring) => (
          <span key={ring} className="door-ring-in absolute left-0 top-0 size-0" style={vars({ "--d": `${0.3 + ring * 0.1}s` })}>
            <span
              className="door-ring door-drift absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                width: `${7.5 + ring * 5.5}rem`,
                height: `${7.5 + ring * 5.5}rem`,
                ...vars({ "--float": `${11 + ring * 2}s`, "--d": `${1.4 + ring * 0.4}s` }),
              }}
            />
          </span>
        ))}
        <span className="door-fade-in absolute left-0 top-0 size-0" style={vars({ "--d": "0.2s" })}>
          <span className="door-halo door-breathe absolute left-0 top-0 size-[9.5rem] -translate-x-1/2 -translate-y-1/2 rounded-full" />
        </span>
        <div className="door-mark-in absolute left-0 top-0 z-10 -translate-x-1/2 -translate-y-1/2" style={vars({ "--d": "0.05s" })}>
          <span
            className="relative flex size-[76px] items-center justify-center rounded-[22px] text-white shadow-[0_1px_0_rgb(255_255_255/0.35)_inset,0_18px_40px_-12px_rgb(37_79_65/0.45),0_4px_12px_-4px_rgb(37_79_65/0.3)]"
            style={{ backgroundImage: `linear-gradient(to bottom, ${tint[0]}, ${tint[1]})` }}
          >
            <span className="absolute inset-0 rounded-[22px] bg-gradient-to-b from-white/25 to-transparent to-55%" />
            <Icon className="relative" size={34} strokeWidth={1.9} />
            <AnimatePresence initial={false}>
              {count > 0 && (
                <motion.span
                  key={count}
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", bounce: 0.35, duration: 0.4 }}
                  className="absolute -end-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-danger px-1.5 text-[13px] font-bold tabular-nums text-white ring-[3px] ring-bg"
                >
                  {count > 99 ? "99+" : count}
                </motion.span>
              )}
            </AnimatePresence>
          </span>
        </div>
      </div>

      <AnimatePresence>
        {chips.slice(0, seats.length).map((chip, index) => {
          const seat = seats[index];
          const x = rtl ? 100 - seat.x : seat.x;
          const arrive = first ? 0.5 + index * 0.09 : 0;
          return (
            <motion.div
              key={chip.id}
              exit={{ opacity: 0, transition: { duration: 0.25, ease: easeOut } }}
              // A card moving to another seat (one before it was done) glides there.
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
                    style={vars({
                      "--d": `${arrive}s`,
                      "--fx": `${Math.round((50 - x) * 0.6)}px`,
                      "--fy": `${Math.round((50 - seat.y) * 0.6)}px`,
                    })}
                  >
                    <div className="flex max-w-[10.5rem] items-center gap-2.5 rounded-[18px] bg-surface py-2 ps-2 pe-3.5 shadow-[0_1px_1px_rgb(40_30_20/0.04),0_14px_32px_-14px_rgb(40_30_20/0.26)] ring-1 ring-[light-dark(rgb(40_30_20/0.06),rgb(255_255_255/0.08))]">
                      {chip.visual}
                      <span className="flex min-w-0 flex-col">
                        <span dir="auto" className="truncate text-[14px] font-semibold leading-[1.2] tracking-[-0.01em] text-label">
                          {chip.title}
                        </span>
                        {chip.note && <span className="mt-0.5 truncate text-[12px] leading-[1.2] text-label/[0.68]">{chip.note}</span>}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
