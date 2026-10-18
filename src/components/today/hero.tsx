"use client";

import Image from "next/image";
import Link from "next/link";
import { Settings } from "lucide-react";
import { motion } from "motion/react";
import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
import { fromDayKey, type DayKey } from "@/lib/dates";
import { Tilt } from "@/components/ui/tilt";
import { enter, settle } from "@/lib/motion";

type Period = "morning" | "afternoon" | "evening" | "night";

function periodFor(hour: number): Period {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

const rise = {
  hidden: { opacity: 0, transform: "translateY(6px)", filter: "blur(3px)" },
  shown: { opacity: 1, transform: "translateY(0px)", filter: "blur(0px)" },
};

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
  const ready = today !== null && hour !== null;

  const summary =
    openCount === 0
      ? dict.today.summary.none
      : openCount === 1
        ? dict.today.summary.one
        : format(dict.today.summary.many, { count: openCount });

  return (
    <section className="relative isolate grid min-h-48 grid-cols-[1fr_44%] items-center overflow-hidden rounded-[28px] bg-[#fde8d1] text-[#2b2118] shadow-card ring-1 ring-hairline md:min-h-60">
      <motion.div
        initial="hidden"
        animate={ready ? "shown" : "hidden"}
        transition={{ staggerChildren: 0.04 }}
        className="relative z-10 flex flex-col gap-1 py-6 ps-5 md:ps-8"
      >
        <h1 className="flex flex-col">
          <motion.span variants={rise} transition={enter()} className="text-[17px] font-medium text-[#2b2118]/65 md:text-xl">
            {ready ? `${dict.today.greeting[periodFor(hour)]},` : "\u00a0"}
          </motion.span>
          <motion.span variants={rise} transition={enter()} className="text-[34px] font-bold leading-tight tracking-tight md:text-5xl">
            {name}
          </motion.span>
        </h1>
        <motion.p variants={rise} transition={enter()} className="mt-2 text-[15px] font-medium text-[#2b2118]/70">
          {ready ? summary : "\u00a0"}
        </motion.p>
        <motion.p variants={rise} transition={enter()} className="text-[13px] text-[#2b2118]/50">
          {ready
            ? new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }).format(fromDayKey(today))
            : "\u00a0"}
        </motion.p>
      </motion.div>

      <motion.div {...settle} className="relative -me-3 aspect-square self-end md:-me-2">
        <Tilt max={14} className="absolute inset-0">
          <Image
            src="/illustrations/home.jpg"
            alt=""
            fill
            priority
            sizes="(min-width: 768px) 300px, 45vw"
            className="pointer-events-none object-contain [mask-image:radial-gradient(closest-side,black_72%,transparent)]"
          />
        </Tilt>
      </motion.div>

      <Link
        href={`/${locale}/settings`}
        aria-label={dict.nav.settings}
        className="absolute end-3 top-3 z-20 flex size-9 items-center justify-center rounded-full bg-white/55 text-[#2b2118]/75 backdrop-blur-md transition-[scale,background-color] duration-150 ease-out active:scale-90 active:bg-white/80 md:hidden"
      >
        <Settings aria-hidden size={19} strokeWidth={2} />
      </Link>
    </section>
  );
}
