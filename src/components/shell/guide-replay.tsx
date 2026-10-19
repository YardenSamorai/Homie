"use client";

import { useI18n } from "@/i18n/dictionary-provider";
import { useAuth } from "@/lib/auth/session";
import { replayGuides } from "./screen-guide";

export function GuideReplay() {
  const { dict } = useI18n();
  const userId = useAuth((s) => s.session?.userId) ?? "local";

  return (
    <button
      type="button"
      onClick={() => replayGuides(userId)}
      className="min-h-11 px-4 text-[15px] font-semibold text-accent active:opacity-60"
    >
      {dict.guides.replay}
    </button>
  );
}
