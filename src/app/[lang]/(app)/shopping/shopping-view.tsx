"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Plus, ShoppingBasket } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { CheckCircle } from "@/components/ui/check-circle";
import { EmptyState } from "@/components/ui/empty-state";
import { StrikeText } from "@/components/ui/strike-text";
import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
import { completionHaptic } from "@/lib/haptics";
import type { ShoppingItem } from "@/lib/household";
import { useHousehold } from "@/lib/household-store";
import { easeOut, spring } from "@/lib/motion";

const separator =
  "relative after:absolute after:inset-x-0 after:bottom-0 after:ms-[60px] after:h-px after:bg-separator last:after:hidden";

function ItemRow({ item }: { item: ShoppingItem }) {
  const { dict } = useI18n();
  const { members, toggleShoppingItem } = useHousehold();
  const addedBy = members.find((m) => m.id === item.addedBy);
  const bought = item.checkedAt !== null;

  return (
    <div className="flex min-h-14 items-center gap-3 px-4 py-2.5">
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
      <div className="flex min-w-0 flex-1 flex-col">
        <StrikeText done={bought}>{item.name}</StrikeText>
        {item.note && <span className="truncate text-[13px] text-label-secondary">{item.note}</span>}
      </div>
      {addedBy && (
        <span title={format(dict.shopping.addedBy, { name: addedBy.name })} className="flex">
          <Avatar member={addedBy} size={24} />
          <span className="sr-only">{format(dict.shopping.addedBy, { name: addedBy.name })}</span>
        </span>
      )}
    </div>
  );
}

function ItemList({ items }: { items: ShoppingItem[] }) {
  return (
    <ul className="overflow-hidden rounded-card bg-surface shadow-card">
      <AnimatePresence initial={false}>
        {items.map((item) => (
          <motion.li
            key={item.id}
            layoutId={`shopping-${item.id}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ layout: spring.gentle, opacity: { duration: 0.2, ease: easeOut } }}
            className={separator}
          >
            <ItemRow item={item} />
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}

export function ShoppingView() {
  const { dict } = useI18n();
  const { seeded, shopping, addShoppingItem, clearBought } = useHousehold();
  const [name, setName] = useState("");

  if (!seeded) return <div aria-hidden className="h-64" />;

  const toBuy = shopping.filter((item) => !item.checkedAt);
  const bought = shopping.filter((item) => item.checkedAt);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) return;
    addShoppingItem({ name: clean, note: null });
    setName("");
  };

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={submit} className="flex items-center gap-3 rounded-card bg-surface px-4 shadow-card">
        <span aria-hidden className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-green text-white">
          <Plus size={18} strokeWidth={2.75} />
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={dict.add.itemName}
          aria-label={dict.add.itemName}
          enterKeyHint="done"
          maxLength={120}
          className="h-14 min-w-0 flex-1 bg-transparent text-[17px] outline-none placeholder:text-label-tertiary"
        />
      </form>

      {shopping.length === 0 ? (
        <div className="rounded-card bg-surface shadow-card">
          <EmptyState icon={ShoppingBasket} illustration="/illustrations/shopping.jpg" tint="var(--green)" title={dict.shopping.empty} hint={dict.shopping.emptyHint} />
        </div>
      ) : (
        <>
          {toBuy.length > 0 && <ItemList items={toBuy} />}
          {bought.length > 0 && (
            <section className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-1">
                <h2 className="section-label text-label-secondary">{dict.shopping.bought}</h2>
                <button
                  type="button"
                  onClick={clearBought}
                  className="min-h-8 px-1 text-[15px] font-medium text-accent transition-opacity active:opacity-60"
                >
                  {dict.shopping.clearBought}
                </button>
              </div>
              <ItemList items={bought} />
            </section>
          )}
        </>
      )}
    </div>
  );
}
