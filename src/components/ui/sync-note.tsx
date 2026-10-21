"use client";

import { CircleAlert, Clock, RotateCcw } from "lucide-react";
import { useI18n } from "@/i18n/dictionary-provider";
import { retry, useRowState } from "@/lib/supabase/outbox";
import { useOnlineStatus } from "@/lib/use-online-status";

/** Under a row's title: "Waiting for connection" while offline, "Not saved" when the server refused the change. */
export function SyncCaption({ id }: { id: string }) {
  const { dict } = useI18n();
  const state = useRowState(id);
  const online = useOnlineStatus();
  if (state === "failed") {
    return (
      <span className="mt-0.5 flex items-center gap-1 text-[13px] font-medium text-danger">
        <CircleAlert aria-hidden size={13} strokeWidth={2.25} />
        {dict.sync.failed}
      </span>
    );
  }
  if (state === "waiting" && !online) {
    return (
      <span className="mt-0.5 flex items-center gap-1 text-[13px] text-label-secondary">
        <Clock aria-hidden size={12} strokeWidth={2.25} />
        {dict.sync.waiting}
      </span>
    );
  }
  return null;
}

/** At the row's end, only when its change didn't save: one tap sends it again. */
export function SyncRetry({ id, label }: { id: string; label: string }) {
  const { dict } = useI18n();
  const state = useRowState(id);
  if (state !== "failed") return null;
  return (
    <button
      type="button"
      onClick={() => retry(id)}
      aria-label={`${dict.sync.retry}: ${label}`}
      className="-m-2 flex size-11 shrink-0 items-center justify-center rounded-full text-accent transition-transform duration-150 ease-out active:scale-90"
    >
      <RotateCcw aria-hidden size={18} strokeWidth={2.25} />
    </button>
  );
}
