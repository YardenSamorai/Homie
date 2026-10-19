"use client";

import { motion, useReducedMotion } from "motion/react";
import { easeOut } from "@/lib/motion";

export function AuthShell({
  title,
  lead,
  eyebrow,
  hero,
  children,
  footer,
  size = "mid",
  busy = false,
}: {
  title?: string;
  lead?: string;
  eyebrow?: string;
  hero?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  /** Invite cards sit at mid-screen; forms can grow a little for the keyboard. */
  size?: "mid" | "tall";
  busy?: boolean;
}) {
  const reduce = useReducedMotion();
  const item = {
    hidden: reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(12px)" },
    show: {
      opacity: 1,
      transform: "translateY(0px)",
      transition: { duration: 0.32, ease: easeOut },
    },
  };

  return (
    <section
      aria-busy={busy || undefined}
      className={`onboard-sheet relative z-10 flex w-full shrink-0 flex-col rounded-t-[32px] bg-sheet text-label shadow-[0_-18px_48px_rgb(40_30_20/0.16)] ${
        size === "tall"
          ? "min-h-[min(58dvh,36rem)] max-h-[min(78dvh,44rem)]"
          : "min-h-[min(52dvh,32rem)] max-h-[min(62dvh,38rem)]"
      }`}
    >
      <div className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2">
        <div aria-hidden className="relative z-10 mx-auto mb-8 mt-0.5 h-[5px] w-9 shrink-0 rounded-full bg-label-tertiary" />
        <motion.div
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: reduce ? 0 : 0.05 } },
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          {hero && (
            <motion.div variants={item} className="mb-5">
              {hero}
            </motion.div>
          )}
          {eyebrow && (
            <motion.p variants={item} className="mb-1 text-[13px] font-semibold text-today">
              {eyebrow}
            </motion.p>
          )}
          {title && (
            <motion.h1
              variants={item}
              className="text-[28px] font-bold leading-tight tracking-tight break-words text-balance"
            >
              {title}
            </motion.h1>
          )}
          {lead && (
            <motion.p variants={item} className="mt-1.5 text-[15px] leading-snug text-label-secondary text-pretty">
              {lead}
            </motion.p>
          )}
          {children && (
            <motion.div variants={item} className="mt-auto flex flex-col pt-6">
              {children}
            </motion.div>
          )}
          {footer && (
            <motion.div variants={item} className="mt-4 text-center text-[15px] text-label-secondary">
              {footer}
            </motion.div>
          )}
        </motion.div>
      </div>
    </section>
  );
}

export const fieldClass =
  "h-12 w-full rounded-xl bg-surface px-4 text-[16px] text-label shadow-card outline-none ring-1 ring-[light-dark(rgb(40_30_20/0.04),rgb(255_255_255/0.06))] placeholder:text-label-tertiary";

export const primaryClass =
  "flex min-h-12 w-full items-center justify-center rounded-full bg-accent text-[17px] font-semibold text-accent-contrast transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-35";

/** Terracotta — joining or creating the house, not a generic continue. */
export const homeClass =
  "flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-coral text-[17px] font-semibold text-white transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-35";

export const successClass =
  "flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-success text-[17px] font-semibold text-white transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-35";

export const ghostClass =
  "flex min-h-11 w-full items-center justify-center text-[15px] font-semibold text-accent transition-opacity duration-150 active:opacity-60 disabled:opacity-35";
