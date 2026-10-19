"use client";

import { SkyScene } from "@/components/today/sky-scene";
import { useI18n } from "@/i18n/dictionary-provider";

/** Full-bleed painted house that lives in the band above the onboarding sheet. */
export function OnboardSky() {
  const { dict } = useI18n();

  return (
    <>
      <SkyScene />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/20 to-transparent" />
      <div className="absolute inset-x-0 top-0 z-10 px-6 pt-[max(1rem,env(safe-area-inset-top))]">
        <p className="text-[22px] font-bold tracking-tight [color:var(--scene-ink)] [text-shadow:var(--scene-text-shadow)]">
          Homie
        </p>
        <p className="mt-0.5 text-[15px] font-medium [color:var(--scene-ink)] [text-shadow:var(--scene-text-shadow)]">
          {dict.auth.skyCaption}
        </p>
      </div>
    </>
  );
}
