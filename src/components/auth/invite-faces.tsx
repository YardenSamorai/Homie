"use client";

import { Plus } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Avatar } from "@/components/ui/avatar";
import { Tilt } from "@/components/ui/tilt";
import { settle } from "@/lib/motion";
import type { Member } from "@/lib/tasks";

export const inviterColor = "var(--indigo)";
export const partnerColor = "var(--pink)";

export function memberFrom(name: string, color: string, id = "face"): Member {
  return { id, name: name.trim(), color };
}

/** Two overlapping seats: who is already home, and who the invite is for. */
export function InviteFaces({
  left,
  right,
  emptyLabel,
}: {
  left: Member;
  right: Member | "empty";
  emptyLabel: string;
}) {
  const reduce = useReducedMotion();
  const rightName = right === "empty" ? emptyLabel : right.name;
  const motionProps = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.2 } }
    : settle;

  return (
    <div className="flex flex-col items-center">
      <motion.div {...motionProps} className="relative mx-auto h-[72px] w-[118px]">
        <span
          aria-hidden
          className="pointer-events-none absolute start-1 top-4 size-12 rounded-full bg-indigo/35 blur-xl"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute end-1 top-4 size-12 rounded-full bg-pink/35 blur-xl"
        />
        <Tilt className="absolute inset-0" max={14}>
          <span className="absolute start-0 top-0 z-[1] drop-shadow-[0_8px_16px_rgb(40_30_20/0.18)]">
            <Avatar member={left} size={72} />
          </span>
          <span className="absolute end-0 top-0 z-[2] drop-shadow-[0_8px_16px_rgb(40_30_20/0.18)]">
            {right === "empty" ? (
              <span
                aria-hidden
                className="flex size-[72px] items-center justify-center rounded-full bg-pink/15 text-pink ring-[5px] ring-sheet"
              >
                <Plus size={28} strokeWidth={1.75} />
              </span>
            ) : (
              <span className="block rounded-full ring-[5px] ring-sheet">
                <Avatar member={right} size={72} />
              </span>
            )}
          </span>
        </Tilt>
      </motion.div>
      <p className="sr-only">{`${left.name || rightName}, ${rightName}`}</p>
      <div className="mt-3 flex max-w-full items-center justify-center gap-2">
        <NameChip color="var(--indigo)" label={left.name || "·"} />
        <NameChip color="var(--pink)" label={rightName} />
      </div>
    </div>
  );
}

function NameChip({ color, label }: { color: string; label: string }) {
  return (
    <span
      style={{
        color,
        backgroundColor: `color-mix(in oklab, ${color} 16%, transparent)`,
      }}
      className="max-w-[9.5rem] truncate rounded-full px-2.5 py-0.5 text-[12px] font-semibold"
    >
      {label}
    </span>
  );
}
