"use client";

import { useRef, type MouseEvent } from "react";
import Link from "next/link";
import { Settings } from "lucide-react";
import { motion } from "motion/react";
import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
import { fromDayKey, type DayKey } from "@/lib/dates";
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
  return (
    <section
      onClick={summon}
      className="relative isolate aspect-[16/9] overflow-clip rounded-[28px] shadow-card ring-1 ring-hairline md:aspect-[21/9]"
    >
      <SkyScene ref={scene} />

      <motion.div
        initial="hidden"
        animate={ready ? "shown" : "hidden"}
        transition={{ staggerChildren: 0.04 }}
        className="relative flex w-[60%] flex-col py-5 ps-5 transition-colors duration-1000 [color:var(--scene-ink)] [text-shadow:var(--scene-text-shadow)] md:py-8 md:ps-8"
      >
        <h1 className="flex flex-col">
          <motion.span variants={rise} transition={enter()} className="text-[15px] font-semibold opacity-80 md:text-xl">
            {ready ? `${dict.today.greeting[periodFor(hour)]},` : "\u00a0"}
          </motion.span>
          <motion.span
            variants={rise}
            transition={enter()}
            className="truncate text-[32px] font-bold leading-[1.15] tracking-tight md:text-5xl"
          >
            {name}
          </motion.span>
        </h1>
        <motion.p variants={rise} transition={enter()} className="mt-1.5 text-[15px] font-medium opacity-90 md:text-[17px]">
          {ready ? summary : "\u00a0"}
        </motion.p>
        <motion.p variants={rise} transition={enter()} className="text-[13px] font-medium opacity-75 md:text-[15px]">
          {ready
            ? new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }).format(fromDayKey(today))
            : "\u00a0"}
        </motion.p>
      </motion.div>

      <Link
        href={`/${locale}/settings`}
        aria-label={dict.nav.settings}
        className="absolute end-3 top-3 flex size-9 items-center justify-center rounded-full ring-1 ring-white/25 backdrop-blur-md transition-[scale,color,background-color] duration-150 ease-out [background-color:var(--scene-glass)] [color:var(--scene-ink)] before:absolute before:-inset-1 active:scale-95 md:hidden"
      >
        <Settings aria-hidden size={19} strokeWidth={2} />
      </Link>
    </section>
  );
}
