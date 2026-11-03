"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Sheet, SheetBody, SheetHeader, sheetGroup } from "@/components/ui/sheet";
import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
import type { ShoppingItem } from "@/lib/household";
import { sameAmount } from "@/lib/quantity";
import type { MergePlan } from "@/lib/shopping-merge";
import { Askers, useAmountText } from "./item-meta";
import { useMergeSheet, useShoppingActions } from "./shopping-actions";
import { useSignedPhotos } from "./store-mode";

function Choice({ label, selected, onSelect, children }: { label?: string; selected: boolean; onSelect: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      onClick={onSelect}
      className="flex min-h-12 w-full items-center gap-3 px-4 text-start text-[17px]"
    >
      <span className="min-w-0 flex-1">{children}</span>
      <Check aria-hidden size={20} strokeWidth={2.5} className={`shrink-0 text-accent ${selected ? "" : "invisible"}`} />
    </button>
  );
}

function Side({ item }: { item: ShoppingItem }) {
  const amountText = useAmountText();
  const detail = [amountText(item), item.note].filter(Boolean).join(" · ");
  return (
    <div className="flex min-h-14 items-center gap-3 px-4 py-2">
      <span className="flex min-w-0 flex-1 flex-col">
        <span dir="auto" className="truncate text-[17px]">
          {item.name}
        </span>
        {detail && <span className="truncate text-[13px] text-label-secondary">{detail}</span>}
      </span>
      <Askers item={item} />
    </div>
  );
}

function MergeForm({ plan, onDone }: { plan: MergePlan; onDone: () => void }) {
  const { dict } = useI18n();
  const copy = dict.shopping;
  const actions = useShoppingActions();
  const amountText = useAmountText();
  const urls = useSignedPhotos(plan.photos);
  const [amount, setAmount] = useState<number | null>(plan.amounts.pick);
  const [note, setNote] = useState(0);
  const [photo, setPhoto] = useState(0);
  const sum = plan.amounts.pick === 0 && plan.amounts.options.length > 1 ? plan.amounts.options[0] : null;

  const confirm = () => {
    if (amount === null) return;
    actions.merge(plan, {
      amount: plan.amounts.options[amount],
      note: plan.notes[note] ?? null,
      photoPath: plan.photos[photo] ?? null,
    });
    onDone();
  };

  return (
    <>
      <SheetHeader title={copy.mergeTitle} cancel={dict.add.cancel} action={{ label: copy.merge, onClick: confirm, disabled: amount === null }} />
      <SheetBody>
        <div>
          <p className="px-4 pb-1.5 text-[13px] text-label-secondary">{format(copy.mergeInto, { name: plan.keep.name })}</p>
          <div className={sheetGroup}>
            <Side item={plan.keep} />
            <Side item={plan.drop} />
          </div>
        </div>

        {plan.amounts.options.length > 1 && (
          <div>
            <p className="px-4 pb-1.5 text-[13px] text-label-secondary">{plan.amounts.pick === null ? copy.mergeChooseAmount : copy.mergeAmount}</p>
            <div role="radiogroup" aria-label={copy.mergeAmount} className={sheetGroup}>
              {plan.amounts.options.map((option, index) => (
                <Choice key={index} selected={amount === index} onSelect={() => setAmount(index)}>
                  <span className="tabular-nums">{amountText(option) ?? copy.mergeNoAmount}</span>
                  {sum && sameAmount(option, sum) && index === 0 && <span className="text-label-secondary"> · {copy.mergeTogether}</span>}
                </Choice>
              ))}
            </div>
          </div>
        )}

        {plan.notes.length > 1 && (
          <div>
            <p className="px-4 pb-1.5 text-[13px] text-label-secondary">{copy.mergeNote}</p>
            <div role="radiogroup" aria-label={copy.mergeNote} className={sheetGroup}>
              {plan.notes.map((option, index) => (
                <Choice key={option} selected={note === index} onSelect={() => setNote(index)}>
                  <span dir="auto">{option}</span>
                </Choice>
              ))}
            </div>
          </div>
        )}

        {plan.photos.length > 1 && (
          <div>
            <p className="px-4 pb-1.5 text-[13px] text-label-secondary">{copy.mergePhoto}</p>
            <div role="radiogroup" aria-label={copy.mergePhoto} className="flex gap-3">
              {plan.photos.map((path, index) => (
                <button
                  key={path}
                  type="button"
                  role="radio"
                  aria-checked={photo === index}
                  aria-label={format(copy.mergePhotoNumber, { index: index + 1 })}
                  onClick={() => setPhoto(index)}
                  className={`size-20 overflow-hidden rounded-xl bg-fill ring-offset-2 ring-offset-sheet ${photo === index ? "ring-2 ring-accent" : ""}`}
                >
                  {urls[path] && <img src={urls[path]} alt="" className="size-full object-cover" />}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            void actions.keepApart(plan.keep, plan.drop);
            onDone();
          }}
          className="min-h-12 w-full rounded-xl bg-surface text-[17px] font-medium text-accent"
        >
          {copy.keepApartLong}
        </button>
      </SheetBody>
    </>
  );
}

/** Before two items become one: which two, the amount it comes to, and the note and photo it keeps. */
export function MergeSheet() {
  const { plan, close } = useMergeSheet();
  // The last plan stays drawn while the sheet slides away.
  const [shown, setShown] = useState(plan);
  if (plan && plan !== shown) setShown(plan);
  return (
    <Sheet open={plan !== null} onOpenChange={(open) => !open && close()}>
      {shown && <MergeForm key={`${shown.keep.id}-${shown.drop.id}`} plan={shown} onDone={close} />}
    </Sheet>
  );
}
