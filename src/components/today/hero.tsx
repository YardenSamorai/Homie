"use client";

import { useRef, type MouseEvent } from "react";
import Link from "next/link";
import { Settings } from "lucide-react";
import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
import type { DayKey } from "@/lib/dates";
import { periodFor } from "@/lib/period";
import { SkyScene, type SkySceneHandle } from "./sky-scene";

/** Full-bleed living sky. Type is the hero; the house is atmosphere. No card chrome. */
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

  return (
    <section
      onClick={summon}
      className="@container relative isolate aspect-[16/10] overflow-clip md:aspect-[2/1]"
    >
      <SkyScene ref={scene} />

      <div className="relative flex h-full w-[50%] flex-col ps-[clamp(16px,5.5cqw,32px)] pt-[max(1.1rem,calc(env(safe-area-inset-top)+0.35rem))] transition-colors duration-1000 [color:var(--scene-ink)] [text-shadow:var(--scene-text-shadow)]">
        <h1 className="flex flex-col">
          <span className="text-[17px] leading-snug opacity-85">
            {ready ? `${dict.today.greeting[periodFor(hour)]},` : "\u00a0"}
          </span>
          <span className="mt-0.5 line-clamp-2 text-[length:clamp(2.25rem,11cqw,3.25rem)] font-semibold leading-[1.04] tracking-[-0.03em] [overflow-wrap:anywhere]">
            <bdi>{name}</bdi>
          </span>
        </h1>
        <p className="mt-2 text-[15px] leading-snug opacity-80">{ready ? summary : "\u00a0"}</p>
      </div>

      <Link
        href={`/${locale}/settings`}
        aria-label={dict.nav.settings}
        className="absolute end-3 top-[max(0.65rem,env(safe-area-inset-top))] flex size-9 items-center justify-center rounded-full ring-1 ring-white/25 backdrop-blur-md transition-[scale,color,background-color] duration-150 ease-out [background-color:var(--scene-glass)] [color:var(--scene-ink)] before:absolute before:-inset-1 active:scale-95 md:hidden"
      >
        <Settings aria-hidden size={18} strokeWidth={1.75} />
      </Link>
    </section>
  );
}
