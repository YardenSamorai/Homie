"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import {
  AnimatePresence,
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import { Check, ShoppingBasket } from "lucide-react";
import { HomieMark } from "@/components/brand/homie-mark";
import { useI18n } from "@/i18n/dictionary-provider";
import { localeDirection } from "@/i18n/config";
import { easeOut } from "@/lib/motion";

export type DoorPhase = "email" | "code" | "done";

type Chip = {
  key: "shopping" | "task" | "event" | "home";
  /** Center of the chip in percent of the stage, as drawn for left-to-right. */
  x: number;
  y: number;
  tilt: number;
  /** How far the chip leans with the pointer, relative to the others. */
  depth: number;
  /** Seconds per float cycle. Different for each chip so they never move in step. */
  float: number;
  /** Chips under the code notification step aside while it is shown. */
  top: boolean;
  /** Fades first when the stage gets short (a small phone, or the keyboard open), so the house keeps its room. */
  minor: boolean;
};

// Listed in the order they arrive: around the house, starting top and going clockwise.
const chips: Chip[] = [
  { key: "shopping", x: 27, y: 14, tilt: -3, depth: 0.9, float: 8.4, top: true, minor: false },
  { key: "task", x: 72, y: 24, tilt: 2.5, depth: 1.2, float: 9.6, top: true, minor: false },
  { key: "event", x: 71, y: 75, tilt: 2, depth: 1.05, float: 8.8, top: false, minor: true },
  { key: "home", x: 28, y: 86, tilt: -2, depth: 0.8, float: 10.4, top: false, minor: true },
];

const cardsStart = 0.62;
const cardsStep = 0.09;

const vars = (values: Record<string, string>) => values as CSSProperties;

export function DoorStage({ phase }: { phase: DoorPhase }) {
  const { locale, dict } = useI18n();
  const rtl = localeDirection[locale] === "rtl";
  const reduce = useReducedMotion();
  const stage = useRef<HTMLDivElement>(null);
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const tiltX = useSpring(pointerX, { stiffness: 120, damping: 20 });
  const tiltY = useSpring(pointerY, { stiffness: 120, damping: 20 });

  // A mouse over the stage leans the scene a few pixels. Touch screens and reduced motion keep it still.
  useEffect(() => {
    const el = stage.current;
    if (!el || reduce || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const move = (event: PointerEvent) => {
      const box = el.getBoundingClientRect();
      pointerX.set(((event.clientX - box.left) / box.width - 0.5) * 2);
      pointerY.set(((event.clientY - box.top) / box.height - 0.5) * 2);
    };
    const leave = () => {
      pointerX.set(0);
      pointerY.set(0);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, [reduce, pointerX, pointerY]);

  // The ambient loops stop while the tab is hidden or the stage is scrolled away.
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

  const waiting = phase !== "email";

  return (
    <div ref={stage} aria-hidden className="door-stage relative isolate size-full overflow-hidden select-none">
      <div className="door-glow absolute inset-0 -z-10" />

      {/* A zero-size anchor at the house's center; rings, house, and label hang off it. Symmetric, so physical left is fine in RTL. */}
      <div className="door-shrink absolute left-1/2 top-1/2 size-0 lg:scale-[1.3]">
        {[0, 1, 2].map((ring) => (
          <span
            key={ring}
            className="door-ring-in absolute left-0 top-0 size-0"
            style={vars({ "--d": `${0.42 + ring * 0.1}s` })}
          >
            <span
              className="door-ring door-drift absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                width: `${8.75 + ring * 6.25}rem`,
                height: `${8.75 + ring * 6.25}rem`,
                ...vars({ "--float": `${11 + ring * 2}s`, "--d": `${1.5 + ring * 0.4}s` }),
              }}
            />
          </span>
        ))}

        <AnimatePresence>
          {phase === "code" && !reduce && (
            <motion.span
              key="pulse"
              className="absolute left-0 top-0 size-[8.75rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent"
              initial={{ opacity: 0.45, transform: "scale(0.7)" }}
              animate={{ opacity: 0, transform: "scale(2.1)" }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.2, ease: easeOut }}
            />
          )}
        </AnimatePresence>

        <span className="door-fade-in absolute left-0 top-0 size-0" style={vars({ "--d": "0.3s" })}>
          <span className="door-halo door-breathe absolute left-0 top-0 size-[11rem] -translate-x-1/2 -translate-y-1/2 rounded-full" />
        </span>

        <div className="door-mark-in absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2" style={vars({ "--d": "0.05s" })}>
          <div className="relative">
            <HomieMark size={88} lit={phase === "done"} />
            <AnimatePresence>
              {phase === "done" && (
                <motion.span
                  key="check"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "scale(0.6)" }}
                  animate={{ opacity: 1, transform: "scale(1)" }}
                  transition={{ type: "spring", bounce: 0.3, duration: 0.45, delay: 0.15 }}
                  className="absolute -right-1.5 -top-1.5 flex size-7 items-center justify-center rounded-full bg-green text-white shadow-[0_4px_10px_rgb(37_79_65/0.35)] ring-[3px] ring-bg"
                >
                  <Check size={16} strokeWidth={3} />
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>

        <span className="door-label absolute left-0 top-[3.55rem] -translate-x-1/2 whitespace-nowrap text-[15px] font-semibold tracking-[-0.01em] text-label">
          <span className="door-fade-in block" style={vars({ "--d": "0.4s" })}>
            Homie
          </span>
        </span>
      </div>

      {chips.map((chip, index) => (
        <ChipSlot key={chip.key} chip={chip} index={index} rtl={rtl} hidden={waiting && chip.top} tiltX={tiltX} tiltY={tiltY}>
          <ChipBody chip={chip.key} dict={dict} />
        </ChipSlot>
      ))}

      <AnimatePresence>
        {waiting && (
          <motion.div
            key="notice"
            initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(-28px) scale(0.96)" }}
            animate={{ opacity: 1, transform: "translateY(0px) scale(1)" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(-20px) scale(0.98)" }}
            transition={reduce ? { duration: 0.2 } : { type: "spring", bounce: 0.15, duration: 0.55, delay: 0.1 }}
            className="absolute inset-x-4 top-3 mx-auto max-w-[22rem]"
          >
            <div className="door-notice">
              <Notice dict={dict} done={phase === "done"} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ChipSlot({
  chip,
  index,
  rtl,
  hidden,
  tiltX,
  tiltY,
  children,
}: {
  chip: Chip;
  index: number;
  rtl: boolean;
  hidden: boolean;
  tiltX: MotionValue<number>;
  tiltY: MotionValue<number>;
  children: React.ReactNode;
}) {
  const x = rtl ? 100 - chip.x : chip.x;
  const shift = 7 * chip.depth;
  const leanX = useTransform(tiltX, (value) => value * shift);
  const leanY = useTransform(tiltY, (value) => value * shift);
  const lean = useMotionTemplate`translate(${leanX}px, ${leanY}px)`;
  const arrive = cardsStart + index * cardsStep;

  return (
    <div
      className={`absolute lg:scale-110 ${chip.minor ? "door-minor" : "door-major"}`}
      style={{ left: `${x}%`, top: `${chip.y}%`, transform: `translate(-50%, -50%) rotate(${rtl ? -chip.tilt : chip.tilt}deg)` }}
    >
      <motion.div style={{ transform: lean }}>
        <motion.div
          initial={false}
          animate={hidden ? { opacity: 0, transform: "translateY(6px) scale(0.97)" } : { opacity: 1, transform: "translateY(0px) scale(1)" }}
          transition={{ duration: hidden ? 0.22 : 0.45, ease: easeOut, delay: hidden ? 0 : 0.35 }}
        >
          <div className="door-float" style={vars({ "--float": `${chip.float}s`, "--d": `${arrive + 0.85}s` })}>
            {/* Each chip arrives from a little closer to the house, as if it came out of it. */}
            <div
              className="door-card-in"
              style={vars({
                "--d": `${arrive}s`,
                "--fx": `${Math.round((50 - x) * 0.35)}px`,
                "--fy": `${Math.round((50 - chip.y) * 0.35)}px`,
              })}
            >
              {children}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

type Dict = ReturnType<typeof useI18n>["dict"];

const card =
  "flex items-center gap-3 whitespace-nowrap rounded-[20px] bg-surface py-2.5 ps-2.5 pe-4 shadow-[0_1px_1px_rgb(40_30_20/0.04),0_14px_32px_-14px_rgb(40_30_20/0.26)] ring-1 ring-[light-dark(rgb(40_30_20/0.06),rgb(255_255_255/0.08))]";

function ChipBody({ chip, dict }: { chip: Chip["key"]; dict: Dict }) {
  const a = dict.auth;
  if (chip === "shopping") {
    return (
      <div className={card}>
        <span className="flex size-9 items-center justify-center rounded-[11px] bg-[color-mix(in_oklab,var(--green)_14%,var(--surface))] text-green">
          <ShoppingBasket size={19} strokeWidth={2.1} />
        </span>
        <Lines title={a.stageMilk} note={a.stageMilkNote} />
      </div>
    );
  }
  if (chip === "task") {
    return (
      <div className={card}>
        <span className="flex size-9 items-center justify-center">
          <span className="flex size-[26px] items-center justify-center rounded-full bg-green text-white">
            <Check size={15} strokeWidth={3} />
          </span>
        </span>
        <Lines title={a.stageTask} note={a.stageTaskNote} done />
      </div>
    );
  }
  if (chip === "event") {
    return (
      <div className={card}>
        <span className="flex w-9 flex-col items-center overflow-hidden rounded-[10px] bg-[color-mix(in_oklab,var(--coral)_14%,var(--surface))] leading-none">
          <span className="w-full bg-coral py-[3px] text-center text-[10px] font-bold text-white">{a.stageEventDay}</span>
          <span className="py-[5px] text-[15px] font-bold tabular-nums text-label">24</span>
        </span>
        <Lines title={a.stageEvent} note={a.stageEventNote} />
      </div>
    );
  }
  return (
    <div className={`${card} py-3`}>
      <span className="flex -space-x-2.5 rtl:space-x-reverse">
        <span className="flex size-[30px] items-center justify-center rounded-full bg-indigo text-[13px] font-bold text-white ring-2 ring-surface">
          {a.stageAvatarB}
        </span>
        <span className="flex size-[30px] items-center justify-center rounded-full bg-pink text-[13px] font-bold text-white ring-2 ring-surface">
          {a.stageAvatarA}
        </span>
      </span>
      <span className="text-[15px] font-semibold tracking-[-0.01em] text-label">{a.stageHome}</span>
    </div>
  );
}

function Lines({ title, note, done = false }: { title: string; note: string; done?: boolean }) {
  return (
    <span className="flex flex-col">
      <span
        className={`text-[15px] leading-[1.2] font-semibold tracking-[-0.01em] ${
          done ? "text-label/60 line-through decoration-label/30" : "text-label"
        }`}
      >
        {title}
      </span>
      <span className="mt-0.5 text-[13px] leading-[1.2] text-label/[0.68]">{note}</span>
    </span>
  );
}

function Notice({ dict, done }: { dict: Dict; done: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-[22px] bg-material p-3 pe-4 shadow-[0_18px_40px_-16px_rgb(40_30_20/0.35),0_2px_8px_rgb(40_30_20/0.06)] ring-1 ring-[light-dark(rgb(40_30_20/0.06),rgb(255_255_255/0.08))] backdrop-blur-xl backdrop-saturate-150">
      <HomieMark size={40} lit={done} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-baseline justify-between gap-3">
          <span className="text-[15px] font-semibold text-label">Homie</span>
          <span className="text-[13px] text-label/[0.68]">{dict.auth.notifyNow}</span>
        </span>
        <span className="truncate text-[15px] text-label">{done ? dict.auth.welcomeHome : dict.auth.notifyBody}</span>
      </span>
    </div>
  );
}
