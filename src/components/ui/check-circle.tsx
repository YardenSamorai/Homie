"use client";

import { motion } from "motion/react";
import { easeOut } from "@/lib/motion";

export function CheckCircle({ checked, color }: { checked: boolean; color: string }) {
  return (
    <motion.span
      initial={false}
      animate={{ transform: checked ? ["scale(1)", "scale(1.12)", "scale(1)"] : "scale(1)" }}
      transition={{ duration: 0.3, ease: easeOut }}
      className="relative flex size-[26px] items-center justify-center rounded-full border-2 transition-[border-color,background-color] duration-200 ease-[var(--ease-out-strong)]"
      style={{ borderColor: checked ? color : "var(--label-tertiary)", backgroundColor: checked ? color : "transparent" }}
    >
      <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden>
        <motion.path
          d="M5 12.5l4.5 4.5L19 7.5"
          stroke="white"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={false}
          animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
          transition={{ duration: checked ? 0.25 : 0.12, ease: easeOut, delay: checked ? 0.05 : 0 }}
        />
      </svg>
    </motion.span>
  );
}
