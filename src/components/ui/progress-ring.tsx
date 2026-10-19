"use client";

import { motion, useReducedMotion } from "motion/react";
import { spring } from "@/lib/motion";

/**
 * A thin circular meter. The track stays put; the arc springs to the new share.
 * Decorative around an avatar or next to a count — never the only status.
 */
export function ProgressRing({
  value,
  size = 44,
  stroke = 3,
  color = "var(--accent)",
  children,
}: {
  /** 0–1. Values outside the range are clamped. */
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const share = Math.min(1, Math.max(0, value));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--fill)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={false}
          animate={{ strokeDashoffset: circumference * (1 - share) }}
          transition={reduce ? { duration: 0 } : spring.gentle}
        />
      </svg>
      {children && <span className="absolute inset-[3px] flex items-center justify-center">{children}</span>}
    </span>
  );
}
