"use client";

import { useState } from "react";
import { CloudOff } from "lucide-react";
import { Sheet, SheetBody, SheetHeader, sheetGroup } from "@/components/ui/sheet";
import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
import type { ShoppingItem } from "@/lib/household";
import { useHousehold } from "@/lib/household-store";
import { useOnlineStatus } from "@/lib/use-online-status";
import { useAmountText } from "./item-meta";
import { useShoppingActions } from "./shopping-actions";

function Lines({ title, items, hint }: { title: string; items: ShoppingItem[]; hint?: string }) {
  const amountText = useAmountText();
  if (items.length === 0) return null;
  return (
    <section>
      <h3 className="flex items-baseline gap-1.5 px-4 pb-1.5 text-[13px] text-label-secondary">
        {title}
        <span className="tabular-nums">{items.length}</span>
      </h3>
      <ul className={sheetGroup}>
        {items.map((item) => (
          <li key={item.id} className="flex min-h-11 items-center justify-between gap-3 px-4 py-2 text-[17px]">
            <span dir="auto" className="min-w-0 truncate">
              {item.name}
            </span>
            {amountText(item) && <span className="shrink-0 tabular-nums text-label-secondary">{amountText(item)}</span>}
          </li>
        ))}
      </ul>
      {hint && <p className="px-4 pt-1.5 text-[13px] text-label-secondary">{hint}</p>}
    </section>
  );
}

function FinishForm({ onDone }: { onDone: () => void }) {
  const { dict } = useI18n();
  const copy = dict.shopping;
  const live = useHousehold((s) => s.shopping);
  const actions = useShoppingActions();
  const online = useOnlineStatus();
  // One tap files the trip; a second tap (or a slow sheet) finds nothing left to file. The summary stays as it
  // was while the sheet slides away.
  const [saved, setSaved] = useState<ShoppingItem[] | null>(null);
  const saving = saved !== null;
  const shopping = saved ?? live;
  const bought = shopping.filter((item) => item.checkedAt);
  const missing = shopping.filter((item) => !item.checkedAt && item.missingAt);
  const pending = shopping.filter((item) => !item.checkedAt && !item.missingAt);

  const save = () => {
    if (saving) return;
    setSaved(live);
    actions.finish();
    onDone();
  };

  return (
    <>
      <SheetHeader title={copy.finishTitle} cancel={dict.add.cancel} action={{ label: copy.finishSave, onClick: save, disabled: saving || bought.length === 0 }} />
      <SheetBody>
        {bought.length === 0 ? (
          <p className="px-4 pt-2 text-[17px] text-label-secondary">{copy.finishNothing}</p>
        ) : (
          <p className="px-4 text-[15px] text-label-secondary">{copy.finishHint}</p>
        )}
        <Lines title={copy.finishBought} items={bought} />
        <Lines title={copy.finishMissing} items={missing} hint={copy.finishStays} />
        <Lines title={copy.finishPending} items={pending} hint={missing.length === 0 ? copy.finishStays : undefined} />
        {!online && bought.length > 0 && (
          <p className="flex items-start gap-2 px-4 text-[15px] text-label-secondary">
            <CloudOff aria-hidden size={18} strokeWidth={2} className="mt-0.5 shrink-0" />
            {copy.finishOffline}
          </p>
        )}
        {bought.length > 0 && (
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="min-h-12 w-full rounded-xl bg-accent text-[17px] font-semibold text-accent-contrast transition-transform duration-150 ease-out active:scale-[0.98] disabled:opacity-50"
          >
            {bought.length === 1 ? copy.finishSaveOne : format(copy.finishSaveCount, { count: bought.length })}
          </button>
        )}
      </SheetBody>
    </>
  );
}

/**
 * Ending a shopping trip, separate from leaving store mode: what was bought, what wasn't found, what's still
 * on the list. Saving files the bought items in the history; everything else stays on the list.
 */
export function FinishSheet({ open, onOpenChange, onFinished }: { open: boolean; onOpenChange: (open: boolean) => void; onFinished?: () => void }) {
  const [session, setSession] = useState(0);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setSession((n) => n + 1);
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <FinishForm
        key={session}
        onDone={() => {
          onOpenChange(false);
          onFinished?.();
        }}
      />
    </Sheet>
  );
}
