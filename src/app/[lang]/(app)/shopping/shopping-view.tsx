"use client";

import { motion } from "motion/react";
import { ShoppingBasket } from "lucide-react";
import { CartBanner } from "@/components/shopping/cart-banner";
import { Avatar } from "@/components/ui/avatar";
import { CheckCircle } from "@/components/ui/check-circle";
import { EmptyState } from "@/components/ui/empty-state";
import { StrikeText } from "@/components/ui/strike-text";
import { SyncCaption, SyncRetry } from "@/components/ui/sync-note";
import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
import { dropInCart } from "@/lib/cart-drop";
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

export function ShoppingView() {
  const { dict } = useI18n();
  const { shopping, addShoppingItem, clearBought } = useHousehold();

  const toBuy = shopping.filter((item) => !item.checkedAt);
  const boughtCount = shopping.length - toBuy.length;

  return (
    <div className="flex flex-col gap-6">
      <CartBanner
        history={shopping.map((item) => ({ name: item.name, note: item.note }))}
        inCart={toBuy.map((item) => ({ id: item.id, name: item.name }))}
        onAdd={(name, note, from) => {
          addShoppingItem({ name, note });
          dropInCart({ name, from });
        }}
      />
      {shopping.length === 0 ? (
        <div className="rounded-card bg-surface shadow-card">
          <EmptyState icon={ShoppingBasket} title={dict.shopping.empty} hint={dict.shopping.emptyHint} />
        </div>
      ) : (
        <ul className="overflow-hidden rounded-card bg-surface shadow-card">
          {shopping.map((item) => (
            <li key={item.id} className={separator}>
              <ItemRow item={item} />
            </li>
          ))}
          {boughtCount > 0 && (
            <li className="flex items-center justify-between px-4 py-3">
              <h2 className="section-label text-label-secondary">
                {dict.shopping.bought}
                <span className="ms-1.5 font-medium tabular-nums text-label-tertiary">{boughtCount}</span>
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
  );
}
