"use client";

import { useRef, type MouseEvent } from "react";
import Link from "next/link";
import { Settings } from "lucide-react";
import { motion } from "motion/react";
import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
import type { DayKey } from "@/lib/dates";
import { enter } from "@/lib/motion";
import { periodFor } from "@/lib/period";
import { SkyScene, type SkySceneHandle } from "./sky-scene";

const rise = {
  hidden: { opacity: 0, transform: "translateY(6px)", filter: "blur(3px)" },
  shown: { opacity: 1, transform: "translateY(0px)", filter: "blur(0px)" },
};

/** The household's house under a live sky that follows the real sun through the day. */
export function Hero({
  name,
  today,
  hour,
  openCount,
}: {
  name: string;
  today: DayKey | null;
  hour: number | null;
  openCount: number;
}) {
  const { locale, dict } = useI18n();
  const scene = useRef<SkySceneHandle>(null);
  const ready = today !== null && hour !== null;

  const summary =
    openCount === 0
      ? dict.today.summary.none
      : openCount === 1
        ? dict.today.summary.one
        : format(dict.today.summary.many, { count: openCount });

  const summon = (event: MouseEvent) => {
    if (!(event.target as Element).closest("a")) scene.current?.summon();
  };

  // overflow-clip rather than hidden: a scroll container would pin the aspect ratio and cut off large text instead of growing.
  // Type scales with the card (cqw), and the column stops short of the house, which fills the other 45% of the painting.
  return (
    <section
      onClick={summon}
      className="@container relative isolate aspect-[16/9] overflow-clip rounded-[28px] shadow-card ring-1 ring-hairline md:aspect-[21/9]"
    >
      <SkyScene ref={scene} />

      <motion.div
        initial="hidden"
        animate={ready ? "shown" : "hidden"}
        transition={{ staggerChildren: 0.04 }}
        className="relative flex w-[54%] flex-col pb-4 ps-[clamp(16px,5.5cqw,32px)] pt-[clamp(16px,5.5cqw,32px)] transition-colors duration-1000 [color:var(--scene-ink)] [text-shadow:var(--scene-text-shadow)]"
      >
        <h1 className="flex flex-col">
          <motion.span
            variants={rise}
            transition={enter()}
            className="text-[length:clamp(0.875rem,4.4cqw,1.25rem)] leading-snug opacity-85"
          >
            {ready ? `${dict.today.greeting[periodFor(hour)]},` : "\u00a0"}
          </motion.span>
          <motion.span
            variants={rise}
            transition={enter()}
            className="line-clamp-2 text-[length:clamp(1.75rem,9.4cqw,2.875rem)] font-semibold leading-[1.08] tracking-[-0.02em] [overflow-wrap:anywhere]"
          >
            <bdi>{name}</bdi>
          </motion.span>
        </h1>
        <motion.p
          variants={rise}
          transition={enter()}
          className="mt-[clamp(6px,2cqw,12px)] text-[length:clamp(0.8125rem,4.1cqw,1.0625rem)] leading-snug opacity-85"
        >
          {ready ? summary : "\u00a0"}
        </motion.p>
      </motion.div>

      <Link
        href={`/${locale}/settings`}
        aria-label={dict.nav.settings}
        className="absolute end-3 top-3 flex size-9 items-center justify-center rounded-full ring-1 ring-white/25 backdrop-blur-md transition-[scale,color,background-color] duration-150 ease-out [background-color:var(--scene-glass)] [color:var(--scene-ink)] before:absolute before:-inset-1 active:scale-95 md:hidden"
      >
        <Settings aria-hidden size={18} strokeWidth={1.75} />
      </Link>
    </section>
  );
}
