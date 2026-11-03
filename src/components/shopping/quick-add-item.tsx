"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Link2, Plus, X } from "lucide-react";
import { CheckCircle } from "@/components/ui/check-circle";
import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
import { grocerySuggestions, itemKey, type GroceryHint } from "@/lib/groceries";
import type { NewShoppingItem } from "@/lib/household-store";
import { readAmount, readLegacyNote, type Unit } from "@/lib/quantity";
import { parseItems, type Known, type ParsedItem } from "@/lib/shopping-parse";
import { easeOut } from "@/lib/motion";
import { useAmountText } from "./item-meta";

type Draft = { id: string; text: string; name: string; amount: string; include: boolean; unsure: boolean };

/** An amount typed as text ("2 ק״ג") into a number and unit; anything that isn't only an amount is a note. */
function readTyped(text: string): { quantity: number | null; unit: Unit | null; note: string | null } {
  const clean = text.trim();
  if (!clean) return { quantity: null, unit: null, note: null };
  const amount = readLegacyNote(clean);
  return amount ? { ...amount, note: null } : { quantity: null, unit: null, note: clean };
}

/**
 * The shopping list's add field. One product adds at once ("2 חלב" is two of milk). A sentence or a pasted
 * list with several products opens a short preview to fix before adding them all; the typed text stays in
 * the field until then, so nothing is lost by cancelling.
 */
export function QuickAddItem({
  history,
  known,
  onList,
  onAdd,
}: {
  history: GroceryHint[];
  known: Known;
  /** Item keys already on the list, marked in the preview. */
  onList: ReadonlySet<string>;
  onAdd: (items: NewShoppingItem[]) => void;
}) {
  const { dict, locale } = useI18n();
  const copy = dict.shopping;
  const amountText = useAmountText();
  const rawId = useId().replace(/:/g, "");
  const listId = `${rawId}-suggestions`;
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [nameFocused, setNameFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [active, setActive] = useState(-1);
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const suggestions = drafts ? [] : grocerySuggestions(locale, name, history, quantity);
  const open = nameFocused && !dismissed && suggestions.length > 0;
  const showQuantity = !drafts && (name.trim().length > 0 || quantity.trim().length > 0);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!formRef.current?.contains(event.target as Node)) setDismissed(true);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const reset = () => {
    setName("");
    setQuantity("");
    setDrafts(null);
    setDismissed(true);
    setActive(-1);
  };

  const choose = (item: GroceryHint) => {
    setName(item.name);
    if (item.note) setQuantity(item.note);
    setDismissed(true);
    setActive(-1);
    inputRef.current?.focus();
  };

  const toDraft = (item: ParsedItem): Draft => ({
    id: crypto.randomUUID(),
    text: item.text,
    name: item.name,
    amount: amountText(item) ?? "",
    include: true,
    unsure: item.unsure,
  });

  const review = (text: string) => {
    const parsed = parseItems(text, known);
    if (parsed.length <= 1) return false;
    setDrafts(parsed.map(toDraft));
    setDismissed(true);
    return true;
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const clean = name.trim();
    if (!clean) return;
    if (quantity.trim()) {
      onAdd([{ name: clean, ...readTyped(quantity) }]);
      return reset();
    }
    if (review(clean)) return;
    const one = readAmount(clean);
    onAdd([{ name: one.name, note: null, quantity: one.quantity, unit: one.unit }]);
    reset();
  };

  const addDrafts = () => {
    const chosen = (drafts ?? []).filter((draft) => draft.include && draft.name.trim());
    if (chosen.length === 0) return;
    onAdd(chosen.map((draft) => ({ name: draft.name.trim(), ...readTyped(draft.amount) })));
    reset();
  };

  const patch = (id: string, change: Partial<Draft>) =>
    setDrafts((list) => list?.map((draft) => (draft.id === id ? { ...draft, ...change } : draft)) ?? null);

  /** Undoes a split at "ו": the two halves read again as one product. */
  const join = (index: number) =>
    setDrafts((list) => {
      if (!list || index < 1) return list;
      const merged = parseItems(`${list[index - 1].text} ו${list[index].text}`, () => false)[0];
      if (!merged) return list;
      const next = [...list];
      next.splice(index - 1, 2, { ...toDraft(merged), unsure: false });
      return next;
    });

  const onNameKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(suggestions.length - 1, index + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(-1, index - 1));
    } else if (event.key === "Escape") {
      setDismissed(true);
      setActive(-1);
    } else if (event.key === "Enter" && active >= 0) {
      event.preventDefault();
      const item = suggestions[active];
      if (item) choose(item);
    }
  };

  const included = drafts?.filter((draft) => draft.include && draft.name.trim()).length ?? 0;

  return (
    <div className="flex flex-col gap-2">
      <form ref={formRef} onSubmit={submit} className="relative flex items-center gap-1 rounded-card bg-surface px-1.5 shadow-card">
        {open && (
          <ul
            id={listId}
            role="listbox"
            aria-label={copy.suggestions}
            className="absolute inset-x-3 bottom-full z-10 mb-2 max-h-48 overflow-y-auto rounded-2xl bg-surface py-1 shadow-card"
          >
            {suggestions.map((item, index) => (
              <li key={item.name} role="presentation">
                <button
                  id={`${listId}-${index}`}
                  type="button"
                  role="option"
                  aria-selected={index === active}
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => choose(item)}
                  className={`flex min-h-11 w-full items-center gap-3 px-4 text-start text-[17px] ${index === active ? "bg-fill" : ""}`}
                >
                  <span className="min-w-0 flex-1 truncate">{item.name}</span>
                  {item.note && <span className="shrink-0 text-[15px] text-label-secondary">{item.note}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
        <input
          ref={inputRef}
          value={name}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
          aria-describedby={`${rawId}-hint`}
          onChange={(event) => {
            setName(event.target.value);
            setDismissed(false);
            setActive(-1);
            if (drafts) setDrafts(null);
          }}
          onPaste={(event) => {
            // A pasted list keeps its lines: an input would flatten them into one.
            const text = event.clipboardData.getData("text");
            if (!/\r?\n/.test(text.trim())) return;
            event.preventDefault();
            const flat = text
              .split(/\r?\n/)
              .map((line) => line.trim())
              .filter(Boolean)
              .join(", ");
            setName(flat);
            review(text);
          }}
          onFocus={() => setNameFocused(true)}
          onBlur={() => setNameFocused(false)}
          onKeyDown={onNameKeyDown}
          placeholder={dict.add.itemName}
          aria-label={dict.add.itemName}
          enterKeyHint="done"
          maxLength={600}
          className="h-14 min-w-0 flex-1 bg-transparent ps-2.5 text-[17px] outline-none placeholder:text-label-tertiary"
        />
        {showQuantity && (
          <input
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            placeholder={copy.quantity}
            aria-label={dict.add.amount}
            enterKeyHint="done"
            maxLength={40}
            className="h-9 w-[4.75rem] shrink-0 rounded-full bg-fill text-center text-[17px] outline-none placeholder:text-label-tertiary"
          />
        )}
        <button
          type="submit"
          disabled={!name.trim() || Boolean(drafts)}
          aria-label={dict.add.submit}
          className="flex size-11 shrink-0 items-center justify-center rounded-full transition-transform duration-100 ease-[var(--ease-out-strong)] active:scale-[0.97] disabled:opacity-35"
        >
          <span className="flex size-[26px] items-center justify-center rounded-full bg-green text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.28)]">
            <Plus size={18} strokeWidth={2.75} />
          </span>
        </button>
        <span id={`${rawId}-hint`} className="sr-only">
          {copy.addHint}
        </span>
      </form>

      <AnimatePresence initial={false}>
        {drafts && (
          <motion.section
            key="preview"
            aria-label={format(copy.previewTitle, { count: drafts.length })}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: easeOut }}
            className="overflow-hidden"
          >
            <div className="rounded-card bg-surface shadow-card">
              <p className="px-4 pb-1 pt-3 text-[15px] font-semibold">{format(copy.previewTitle, { count: drafts.length })}</p>
              <ul>
                {drafts.map((draft, index) => {
                  const there = onList.has(itemKey(draft.name));
                  return (
                    <li key={draft.id} className="flex min-h-12 items-center gap-2 border-b border-separator px-2 last:border-b-0">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={draft.include}
                        aria-label={format(copy.previewInclude, { name: draft.name })}
                        onClick={() => patch(draft.id, { include: !draft.include })}
                        className="flex size-11 shrink-0 items-center justify-center"
                      >
                        <CheckCircle checked={draft.include} color="var(--green)" />
                      </button>
                      <span className="flex min-w-0 flex-1 flex-col py-1">
                        <input
                          value={draft.name}
                          onChange={(event) => patch(draft.id, { name: event.target.value })}
                          aria-label={format(copy.previewName, { index: index + 1 })}
                          maxLength={120}
                          className={`min-w-0 bg-transparent text-[17px] outline-none ${draft.include ? "" : "text-label-tertiary"}`}
                        />
                        {(draft.unsure || there) && (
                          <span className="text-[13px] text-label-secondary">{there ? copy.onList : copy.previewUnsure}</span>
                        )}
                      </span>
                      {draft.unsure && (
                        <button
                          type="button"
                          onClick={() => join(index)}
                          aria-label={format(copy.previewJoinNamed, { a: drafts[index - 1]?.name ?? "", b: draft.name })}
                          className="flex min-h-11 shrink-0 items-center gap-1 rounded-full px-2 text-[15px] font-medium text-accent"
                        >
                          <Link2 aria-hidden size={16} strokeWidth={2.25} />
                          {copy.previewJoin}
                        </button>
                      )}
                      <input
                        value={draft.amount}
                        onChange={(event) => patch(draft.id, { amount: event.target.value })}
                        placeholder={copy.quantity}
                        aria-label={format(copy.previewAmount, { name: draft.name })}
                        maxLength={40}
                        className="h-9 w-[5.5rem] shrink-0 rounded-full bg-fill text-center text-[16px] outline-none placeholder:text-label-tertiary"
                      />
                    </li>
                  );
                })}
              </ul>
              <div className="flex items-center justify-end gap-2 px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setDrafts(null);
                    inputRef.current?.focus();
                  }}
                  className="flex min-h-11 items-center gap-1.5 rounded-full px-3 text-[15px] font-medium text-label-secondary"
                >
                  <X aria-hidden size={16} strokeWidth={2.25} />
                  {copy.previewCancel}
                </button>
                <button
                  type="button"
                  onClick={addDrafts}
                  disabled={included === 0}
                  className="min-h-11 rounded-full bg-accent px-5 text-[15px] font-semibold text-accent-contrast transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-35"
                >
                  {format(copy.previewAdd, { count: included })}
                </button>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
