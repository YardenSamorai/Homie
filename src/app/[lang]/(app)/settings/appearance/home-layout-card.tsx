"use client";

import { useState } from "react";
import { ChevronLeft, SlidersHorizontal } from "lucide-react";
import { HomeLayoutSheet } from "@/components/today/home-layout-sheet";
import { Card } from "@/components/ui/card";
import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
import { useAuth } from "@/lib/auth/session";
import { usePrefsOf } from "@/lib/prefs-store";

/** The way in to arranging Today from Settings; the same sheet opens from Today itself. */
export function HomeLayoutCard() {
  const { dict } = useI18n();
  const copy = dict.homeLayout;
  const userId = useAuth((s) => s.session?.userId);
  const layout = usePrefsOf(userId, (prefs) => prefs.home);
  const [open, setOpen] = useState(false);
  const shown = layout.order.length - layout.hidden.length;

  return (
    <Card title={copy.title}>
      <button type="button" onClick={() => setOpen(true)} className="flex min-h-14 w-full items-center gap-3 px-4 py-row text-start active:bg-fill">
        <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-fill text-accent">
          <SlidersHorizontal size={18} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[17px]">{copy.open}</span>
          <span className="text-[14px] text-label-secondary">{format(copy.summary, { shown: String(shown), count: String(layout.order.length) })}</span>
        </span>
        <ChevronLeft aria-hidden size={18} className="shrink-0 text-label-tertiary ltr:-scale-x-100" />
      </button>
      <p className="px-4 pb-3 pt-1 text-[13px] leading-snug text-label-secondary">{copy.lead}</p>
      <HomeLayoutSheet open={open} onOpenChange={setOpen} />
    </Card>
  );
}
