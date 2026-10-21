"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Plus, Repeat, ShoppingBasket } from "lucide-react";
import { PageStage } from "@/components/shell/page-stage";
import { QuickAddItem } from "@/components/shopping/quick-add-item";
import { Avatar } from "@/components/ui/avatar";
import { CheckCircle } from "@/components/ui/check-circle";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { PickMenu } from "@/components/ui/pick-menu";
import { ProgressRing } from "@/components/ui/progress-ring";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { StrikeText } from "@/components/ui/strike-text";
import { SyncCaption, SyncRetry } from "@/components/ui/sync-note";
import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
import type { Dictionary } from "@/i18n/get-dictionary";
import { completionHaptic } from "@/lib/haptics";
import type { ShoppingItem } from "@/lib/household";
import { useAddSheet, useHousehold } from "@/lib/household-store";
import { spring } from "@/lib/motion";

const separator =
  "relative after:absolute after:inset-x-0 after:bottom-0 after:ms-[60px] after:h-px after:bg-separator last:after:hidden";

function ItemRow({ item }: { item: ShoppingItem }) {
  const { dict } = useI18n();
  const { members, toggleShoppingItem } = useHousehold();
  const showEdit = useAddSheet((s) => s.showEdit);
  const addedBy = members.find((m) => m.id === item.addedBy);
  const bought = item.checkedAt !== null;

  return (
    <div className={`flex min-h-14 items-center gap-3 px-4 py-2.5 ${bought ? "opacity-70" : ""}`}>
      <motion.button
        type="button"
        onClick={() => {
          if (!bought) completionHaptic();
          toggleShoppingItem(item.id);
        }}
        whileTap={{ scale: 0.88 }}
        transition={spring.snappy}
        aria-pressed={bought}
        aria-label={format(bought ? dict.shopping.unmark : dict.shopping.mark, { name: item.name })}
        className="-m-[9px] flex size-11 shrink-0 items-center justify-center rounded-full"
      >
        <CheckCircle checked={bought} color="var(--green)" />
      </motion.button>
      <button
        type="button"
        onClick={() => showEdit({ kind: "shopping", id: item.id })}
        aria-label={format(dict.add.editNamed, { title: item.name })}
        className="flex min-w-0 flex-1 touch-manipulation select-none flex-col text-start"
      >
        <StrikeText done={bought}>{item.name}</StrikeText>
        {item.note && <span className="truncate text-[13px] text-label-secondary">{item.note}</span>}
        <SyncCaption id={item.id} />
      </button>
      <SyncRetry id={item.id} label={item.name} />
      {addedBy && (
        <span title={format(dict.shopping.addedBy, { name: addedBy.name })} className="flex">
          <Avatar member={addedBy} size={24} />
          <span className="sr-only">{format(dict.shopping.addedBy, { name: addedBy.name })}</span>
        </span>
      )}
    </div>
  );
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

type Scope = "all" | "toBuy" | "bought";

const staples: (keyof Dictionary["shopping"]["staplesItems"])[] = [
  "milk",
  "bread",
  "eggs",
  "cheese",
  "cottage",
  "tomatoes",
  "cucumbers",
  "bananas",
  "coffee",
  "toiletPaper",
  "dishSoap",
];

/**
 * The home's shopping list: a title that says what's left, the stage with it, then the list, all of it, only
 * what's left to buy, or what's already in the cart.
 */
export function ShoppingView() {
  const { dict } = useI18n();
  const { shopping, members, addShoppingItem, clearBought } = useHousehold();
  const show = useAddSheet((s) => s.show);
  const [scope, setScope] = useState<Scope>("all");
  const copy = dict.shopping;

  const toBuy = shopping.filter((item) => !item.checkedAt);
  const bought = shopping.filter((item) => item.checkedAt);
  const visible = scope === "toBuy" ? toBuy : scope === "bought" ? bought : shopping;
  const onList = new Set(toBuy.map((item) => item.name.trim().toLocaleLowerCase()));

  const title =
    scope === "bought"
      ? bought.length === 0
        ? copy.titleBoughtNone
        : bought.length === 1
          ? copy.titleBoughtOne
          : format(copy.titleBought, { count: bought.length })
      : shopping.length === 0
        ? copy.empty
        : toBuy.length === 0
          ? copy.allBought
          : toBuy.length === 1
            ? copy.titleLeftOne
            : format(copy.titleLeft, { count: toBuy.length });
  const eyebrow =
    shopping.length > 0 ? (
      <span className="flex items-center gap-2">
        <ProgressRing value={bought.length / shopping.length} size={18} stroke={2.25} color="var(--green)" />
        {format(copy.inCart, { bought: bought.length, total: shopping.length })}
      </span>
    ) : undefined;

  const empty =
    scope === "bought"
      ? { title: copy.titleBoughtNone, hint: copy.emptyBought }
      : scope === "toBuy" && shopping.length > 0
        ? { title: copy.allBought, hint: copy.emptyToBuy }
        : { title: copy.empty, hint: copy.emptyHint };

  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} />
      <div className="flex flex-col gap-5">
        <PageStage
          icon={ShoppingBasket}
          tint={["#e9a77f", "#c26a44"]}
          count={toBuy.length}
          chips={toBuy.map((item) => {
            const adder = members.find((member) => member.id === item.addedBy);
            return {
              id: item.id,
              title: item.name,
              note: item.note ?? (adder ? firstName(adder.name) : null),
              visual: (
                <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-[color-mix(in_oklab,var(--green)_14%,var(--surface))] text-green">
                  <ShoppingBasket size={17} strokeWidth={2.1} />
                </span>
              ),
            };
          })}
        />
        <div className="flex items-center gap-3">
          <PickMenu
            label={copy.staples}
            icon={Repeat}
            heading={copy.staplesTitle}
            addedLabel={copy.onList}
            items={staples.map((key) => ({
              id: key,
              label: copy.staplesItems[key],
              added: onList.has(copy.staplesItems[key].toLocaleLowerCase()),
            }))}
            onPick={(key) => addShoppingItem({ name: copy.staplesItems[key as keyof typeof copy.staplesItems], note: null })}
          />
          <button
            type="button"
            onClick={() => show("shopping")}
            className="flex min-h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-accent px-5 text-[16px] font-semibold text-accent-contrast shadow-[0_8px_20px_-6px_color-mix(in_oklab,var(--accent)_55%,transparent),inset_0_1px_0_rgb(255_255_255/0.24)] transition-transform duration-150 ease-out active:scale-[0.97]"
          >
            <Plus aria-hidden size={19} strokeWidth={2.5} />
            <span className="truncate">{copy.newItem}</span>
          </button>
        </div>
        <QuickAddItem history={shopping.map((item) => ({ name: item.name, note: item.note }))} onAdd={(name, note) => addShoppingItem({ name, note })} />
        <SegmentedControl
          label={copy.title}
          value={scope}
          onChange={setScope}
          options={(["all", "toBuy", "bought"] as const).map((value) => ({ value, label: copy.scopes[value] }))}
        />
        {visible.length === 0 ? (
          <div className="flex flex-col items-center rounded-card bg-surface pb-8 shadow-card">
            <EmptyState icon={ShoppingBasket} tint="var(--orange)" title={empty.title} hint={empty.hint} />
            {scope !== "bought" && (
              <button
                type="button"
                onClick={() => show("shopping")}
                className="-mt-4 flex min-h-11 items-center gap-1.5 rounded-full bg-accent ps-4 pe-5 text-[15px] font-semibold text-accent-contrast shadow-[0_6px_16px_-4px_color-mix(in_oklab,var(--accent)_50%,transparent)] transition-transform duration-150 ease-out active:scale-[0.97]"
              >
                <Plus aria-hidden size={17} strokeWidth={2.5} />
                {copy.addItem}
              </button>
            )}
          </div>
        ) : (
          <ul className="overflow-hidden rounded-card bg-surface shadow-card">
            {visible.map((item) => (
              <li key={item.id} className={separator}>
                <ItemRow item={item} />
              </li>
            ))}
            {scope !== "toBuy" && bought.length > 0 && (
              <li className="flex items-center justify-between px-4 py-3">
                <h2 className="section-label text-label-secondary">
                  {copy.bought}
                  <span className="ms-1.5 font-medium tabular-nums text-label-tertiary">{bought.length}</span>
                </h2>
                <button
                  type="button"
                  onClick={clearBought}
                  className="relative min-h-8 px-1 text-[15px] font-medium text-accent transition-opacity before:absolute before:-inset-x-2 before:-inset-y-1.5 active:opacity-60"
                >
                  {dict.shopping.clearBought}
                </button>
              </li>
            )}
          </ul>
        )}
      </div>
    </>
  );
}
