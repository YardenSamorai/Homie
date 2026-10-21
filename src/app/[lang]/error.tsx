"use client";

import { useEffect } from "react";
import { HomieMark } from "@/components/brand/homie-mark";
import { useI18n } from "@/i18n/dictionary-provider";
import { reloadForNewVersion } from "@/lib/report-errors";

/** A screen that crashed: say so calmly, keep the rest of the app, report it, and offer to try again. */
export default function ScreenError({ error, retry }: { error: unknown; retry: () => void }) {
  const { dict } = useI18n();

  useEffect(() => {
    // A new version went live while this screen was open: its code moved on. Load the new version once.
    if (reloadForNewVersion(error)) return;
    const failure = error instanceof Error ? error : new Error(String(error));
    const body = JSON.stringify({ message: `render: ${failure.message}`, stack: failure.stack, path: location.pathname });
    void fetch("/api/client-error", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => {});
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-bg px-8 text-center">
      <HomieMark size={72} />
      <h1 className="mt-3 text-[24px] font-bold tracking-tight">{dict.crash.title}</h1>
      <p className="max-w-[18rem] text-[16px] leading-snug text-label-secondary">{dict.crash.body}</p>
      <button
        type="button"
        onClick={retry}
        className="mt-3 h-12 rounded-full bg-accent px-8 text-[17px] font-semibold text-accent-contrast transition-transform duration-150 ease-out active:scale-[0.97]"
      >
        {dict.crash.retry}
      </button>
    </main>
  );
}
