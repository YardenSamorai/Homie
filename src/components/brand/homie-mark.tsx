"use client";

import { useId } from "react";
import { motion } from "motion/react";

/**
 * The Homie app icon: a cream house on sage. The window lights up when someone comes home,
 * the same warm light the painted house shows at dusk.
 */
export function HomieMark({ size = 88, lit = false }: { size?: number; lit?: boolean }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");

  return (
    <span
      className="relative block shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.235,
        boxShadow:
          "0 1px 0 rgb(255 255 255 / 0.35) inset, 0 18px 40px -12px rgb(37 79 65 / 0.45), 0 4px 12px -4px rgb(37 79 65 / 0.3)",
      }}
    >
      <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden className="block">
        <defs>
          <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#7aa18c" />
            <stop offset="1" stopColor="#3f6655" />
          </linearGradient>
          <linearGradient id={`${id}-gloss`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
            <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <radialGradient id={`${id}-glow`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ffd59a" stopOpacity="0.95" />
            <stop offset="1" stopColor="#ffd59a" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="64" height="64" rx="15" fill={`url(#${id}-bg)`} />
        <rect width="64" height="64" rx="15" fill={`url(#${id}-gloss)`} />
        <path
          d="M32 15.5 48.5 29V44.5a3.5 3.5 0 0 1-3.5 3.5H19a3.5 3.5 0 0 1-3.5-3.5V29Z"
          fill="#fbf7f0"
          stroke="#fbf7f0"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        <motion.circle
          cx="32"
          cy="36.5"
          r="13"
          fill={`url(#${id}-glow)`}
          initial={false}
          animate={{ opacity: lit ? 1 : 0 }}
          transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
        />
        <rect x="27" y="32" width="10" height="9" rx="2.4" fill="#cfe0d5" />
        <motion.rect
          x="27"
          y="32"
          width="10"
          height="9"
          rx="2.4"
          fill="#f4b46a"
          initial={false}
          animate={{ opacity: lit ? 1 : 0 }}
          transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
        />
      </svg>
    </span>
  );
}
