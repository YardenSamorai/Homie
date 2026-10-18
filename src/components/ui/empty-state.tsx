"use client";

import Image from "next/image";
import { motion } from "motion/react";
import type { LucideIcon } from "lucide-react";
import { Tilt } from "@/components/ui/tilt";
import { settle } from "@/lib/motion";

export function EmptyState({
  icon: Icon,
  illustration,
  title,
  hint,
  tint = "var(--accent)",
}: {
  icon: LucideIcon;
  /** A 3D illustration from `/public/illustrations`, shown instead of the icon. */
  illustration?: string;
  title: string;
  hint?: string;
  /** A system color token, e.g. `var(--green)`. */
  tint?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-8 text-center">
      {illustration ? (
        <motion.div {...settle} className="mb-2">
          <Tilt className="relative size-28 overflow-hidden rounded-[28px] shadow-[0_10px_24px_rgb(0_0_0/0.12)] ring-1 ring-hairline">
            <Image src={illustration} alt="" fill sizes="112px" className="pointer-events-none object-cover" />
          </Tilt>
        </motion.div>
      ) : (
        <span
          style={{ color: tint, backgroundColor: `color-mix(in oklab, ${tint} 14%, transparent)` }}
          className="mb-1 flex size-12 items-center justify-center rounded-full"
        >
          <Icon aria-hidden size={24} strokeWidth={1.75} />
        </span>
      )}
      <p className="text-[17px] font-semibold">{title}</p>
      {hint && <p className="max-w-xs text-[15px] text-label-secondary">{hint}</p>}
    </div>
  );
}
