"use client";

import { useRef, type MouseEvent } from "react";
import { motion } from "motion/react";
import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
import type { DayKey } from "@/lib/dates";
import { useAddSheet } from "@/lib/household-store";
import { press } from "@/lib/motion";
import { SkyScene, type SkySceneHandle } from "./sky-scene";

/** The living house, held in a card instead of filling the screen. */
export function HouseCard({ openCount, day }: { openCount: number; day: DayKey | null }) {
  const { dict } = useI18n();
  const scene = useRef<SkySceneHandle>(null);
  const show = useAddSheet((s) => s.show);

  const summary =
    openCount === 0
      ? dict.today.houseCalm
      : openCount === 1
        ? dict.today.summary.one
        : format(dict.today.summary.many, { count: openCount });

  const summon = (event: MouseEvent) => {
    if (!(event.target as Element).closest("button")) scene.current?.summon();
  };

  return (
    <section className="overflow-hidden rounded-[28px] bg-sage-light shadow-card">
      <div onClick={summon} className="relative aspect-[16/10] w-full">
        <SkyScene ref={scene} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-sage-dark/80 via-sage-dark/20 to-transparent px-5 pb-4 pt-16 text-white">
          <p className="text-[22px] font-bold leading-tight tracking-tight">{dict.today.houseTitle}</p>
          <p className="mt-0.5 text-[15px] leading-snug text-white/90">{summary}</p>
        </div>
      </div>
      <div className="flex bg-surface px-4 py-3">
        <motion.button
          type="button"
          whileTap={press}
          onClick={() => show("task", day)}
          className="min-h-11 rounded-full bg-accent px-5 text-[15px] font-semibold text-accent-contrast shadow-[0_6px_16px_color-mix(in_oklab,var(--accent)_28%,transparent),inset_0_1px_0_rgb(255_255_255/0.28)]"
        >
          {dict.today.quickAddHint}
        </motion.button>
      </div>
    </section>
  );
}
