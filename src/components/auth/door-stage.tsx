"use client";

import { useEffect, useRef } from "react";
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
  /**
 * Center of the chip in percent of the stage, as drawn for left-to-right.
 * First-paint `initial` values never branch on reduced motion: the server cannot know it, and the global
 * MotionConfig already skips transform animations for those users.
 */
  x: number;
  y: number;
  tilt: number;
  depth: number;
  /** Chips under the notification step aside while it is shown. */
  top: boolean;
  /** Dropped first on short screens so the icon keeps its room. */
  minor: boolean;
};

const chips: Chip[] = [
  { key: "shopping", x: 25, y: 19, tilt: -3, depth: 0.9, top: true, minor: false },
  { key: "task", x: 75, y: 27, tilt: 2.5, depth: 1.25, top: true, minor: false },
  { key: "event", x: 23, y: 77, tilt: 2, depth: 1.1, top: false, minor: true },
  { key: "home", x: 75, y: 84, tilt: -2, depth: 0.75, top: false, minor: true },
];

const settle = { type: "spring", bounce: 0, duration: 0.7 } as const;

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

  const waiting = phase !== "email";

  return (
    <div ref={stage} aria-hidden className="door-stage relative isolate size-full overflow-hidden select-none">
      <div className="absolute inset-0 -z-10 door-glow" />

      {/* A zero-size anchor at the icon's center; rings, icon, and label hang off it. Symmetric, so physical left is fine in RTL. */}
      <div className="absolute left-1/2 top-[50%] size-0 lg:scale-[1.3]">
        {[0, 1, 2].map((ring) => (
          <motion.span
            key={ring}
            className="door-ring absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ width: `${8.75 + ring * 6.25}rem`, height: `${8.75 + ring * 6.25}rem` }}
            initial={{ opacity: 0, transform: "scale(0.92)" }}
            animate={{ opacity: 1, transform: "scale(1)" }}
            transition={{ ...settle, delay: reduce ? 0 : 0.05 + ring * 0.06 }}
          />
        ))}
        <AnimatePresence>
          {phase === "code" && !reduce && (
            <motion.span
              key="pulse"
              className="absolute left-0 top-0 size-[8.75rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent"
              initial={{ opacity: 0.5, transform: "scale(0.7)" }}
              animate={{ opacity: 0, transform: "scale(2.1)" }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.1, ease: easeOut }}
            />
          )}
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0, transform: "translateY(10px) scale(0.92)" }}
          animate={{ opacity: 1, transform: "translateY(0px) scale(1)" }}
          transition={{ type: "spring", bounce: 0.18, duration: 0.8 }}
          className="absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2"
        >
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
        </motion.div>
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: reduce ? 0 : 0.25 }}
          className="absolute left-0 top-[3.6rem] -translate-x-1/2 whitespace-nowrap text-[14px] font-semibold tracking-[-0.01em] text-label [@media(max-height:560px)]:hidden"
        >
          Homie
        </motion.span>
      </div>

      {chips.map((chip, index) => (
        <ChipSlot
          key={chip.key}
          chip={chip}
          index={index}
          rtl={rtl}
          hidden={waiting && chip.top}
          tiltX={tiltX}
          tiltY={tiltY}
          reduce={Boolean(reduce)}
        >
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
            transition={reduce ? { duration: 0.2 } : { type: "spring", bounce: 0.15, duration: 0.55, delay: 0.12 }}
            className="absolute inset-x-4 top-[max(1rem,env(safe-area-inset-top))] mx-auto max-w-[22rem]"
          >
            <Notice dict={dict} done={phase === "done"} />
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
  reduce,
  children,
}: {
  chip: Chip;
  index: number;
  rtl: boolean;
  hidden: boolean;
  tiltX: MotionValue<number>;
  tiltY: MotionValue<number>;
  reduce: boolean;
  children: React.ReactNode;
}) {
  const shift = 7 * chip.depth;
  const leanX = useTransform(tiltX, (value) => value * shift);
  const leanY = useTransform(tiltY, (value) => value * shift);
  const lean = useMotionTemplate`translate(${leanX}px, ${leanY}px)`;

  return (
    <div
      className={`absolute lg:scale-110 ${chip.minor ? "[@media(max-height:700px)]:hidden" : ""} [@media(max-height:560px)]:hidden`}
      style={{
        left: `${rtl ? 100 - chip.x : chip.x}%`,
        top: `${chip.y}%`,
        transform: `translate(-50%, -50%) rotate(${rtl ? -chip.tilt : chip.tilt}deg)`,
      }}
    >
      <motion.div style={{ transform: lean }}>
        <motion.div
          initial={{ opacity: 0, transform: "translateY(14px) scale(0.95)" }}
          animate={
            hidden
              ? { opacity: 0, transform: reduce ? "translateY(0px) scale(1)" : "translateY(6px) scale(0.97)" }
              : { opacity: 1, transform: "translateY(0px) scale(1)" }
          }
          transition={hidden ? { duration: 0.22, ease: easeOut } : { ...settle, delay: reduce ? 0 : 0.18 + index * 0.07 }}
        >
          {children}
        </motion.div>
      </motion.div>
    </div>
  );
}

type Dict = ReturnType<typeof useI18n>["dict"];

const card =
  "flex items-center gap-2.5 whitespace-nowrap rounded-[18px] bg-surface py-2.5 ps-2.5 pe-3.5 shadow-[0_14px_34px_-14px_rgb(40_30_20/0.28),0_2px_6px_rgb(40_30_20/0.05)] ring-1 ring-[light-dark(rgb(40_30_20/0.05),rgb(255_255_255/0.08))]";

function ChipBody({ chip, dict }: { chip: Chip["key"]; dict: Dict }) {
  const a = dict.auth;
  if (chip === "shopping") {
    return (
      <div className={card}>
        <span className="flex size-8 items-center justify-center rounded-[10px] bg-[color-mix(in_oklab,var(--green)_14%,transparent)] text-green">
          <ShoppingBasket size={17} strokeWidth={2.2} />
        </span>
        <Lines title={a.stageMilk} note={a.stageMilkNote} />
      </div>
    );
  }
  if (chip === "task") {
    return (
      <div className={card}>
        <span className="flex size-[22px] items-center justify-center rounded-full bg-green text-white">
          <Check size={13} strokeWidth={3.2} />
        </span>
        <Lines title={a.stageTask} note={a.stageTaskNote} done />
      </div>
    );
  }
  if (chip === "event") {
    return (
      <div className={card}>
        <span className="flex w-8 flex-col items-center overflow-hidden rounded-[9px] bg-[color-mix(in_oklab,var(--coral)_16%,var(--surface))] leading-none">
          <span className="w-full bg-coral py-[3px] text-center text-[9px] font-bold text-white">{a.stageEventDay}</span>
          <span className="py-1 text-[14px] font-bold tabular-nums text-label">24</span>
        </span>
        <Lines title={a.stageEvent} note={a.stageEventNote} />
      </div>
    );
  }
  return (
    <div className={card}>
      <span className="flex -space-x-2 rtl:space-x-reverse">
        <span className="flex size-7 items-center justify-center rounded-full bg-indigo text-[12px] font-bold text-white ring-2 ring-surface">
          {a.stageAvatarB}
        </span>
        <span className="flex size-7 items-center justify-center rounded-full bg-pink text-[12px] font-bold text-white ring-2 ring-surface">
          {a.stageAvatarA}
        </span>
      </span>
      <Lines title={a.stageHome} note={a.stageHomeNote} />
    </div>
  );
}

function Lines({ title, note, done = false }: { title: string; note: string; done?: boolean }) {
  return (
    <span className="flex flex-col leading-tight">
      <span className={`text-[13px] font-semibold text-label ${done ? "line-through decoration-label-tertiary" : ""}`}>{title}</span>
      <span className="mt-0.5 text-[12px] text-label-secondary">{note}</span>
    </span>
  );
}

function Notice({ dict, done }: { dict: Dict; done: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-[22px] bg-material p-3 pe-4 shadow-[0_18px_40px_-16px_rgb(40_30_20/0.35),0_2px_8px_rgb(40_30_20/0.06)] ring-1 ring-[light-dark(rgb(40_30_20/0.06),rgb(255_255_255/0.08))] backdrop-blur-xl backdrop-saturate-150">
      <HomieMark size={38} lit={done} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-baseline justify-between gap-3">
          <span className="text-[14px] font-semibold text-label">Homie</span>
          <span className="text-[12px] text-label-secondary">{dict.auth.notifyNow}</span>
        </span>
        <span className="truncate text-[14px] text-label">{done ? dict.auth.welcomeHome : dict.auth.notifyBody}</span>
        <span dir="ltr" className="mt-0.5 text-[13px] tracking-[0.35em] text-label-tertiary rtl:text-right">
          ••• •••
        </span>
      </span>
    </div>
  );
}
