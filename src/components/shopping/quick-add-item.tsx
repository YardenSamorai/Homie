"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { useI18n } from "@/i18n/dictionary-provider";
import { grocerySuggestions, type GroceryHint } from "@/lib/groceries";

/** The shopping list's add field: a name with suggestions from what the house buys, and an optional quantity. */
export function QuickAddItem({ history, onAdd }: { history: GroceryHint[]; onAdd: (name: string, note: string | null) => void }) {
  const { dict, locale } = useI18n();
  const rawId = useId().replace(/:/g, "");
  const listId = `${rawId}-suggestions`;
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [nameFocused, setNameFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [active, setActive] = useState(-1);
  const suggestions = grocerySuggestions(locale, name, history, quantity);
  const open = nameFocused && !dismissed && suggestions.length > 0;
  const showQuantity = name.trim().length > 0 || quantity.trim().length > 0;

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!formRef.current?.contains(event.target as Node)) setDismissed(true);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const choose = (item: GroceryHint) => {
    setName(item.name);
    if (item.note) setQuantity(item.note);
    setDismissed(true);
    setActive(-1);
    inputRef.current?.focus();
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const clean = name.trim();
    if (!clean) return;
    onAdd(clean, quantity.trim() || null);
    setName("");
    setQuantity("");
    setDismissed(true);
    setActive(-1);
  };

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

  return (
    <form ref={formRef} onSubmit={submit} className="relative flex items-center gap-1 rounded-card bg-surface px-1.5 shadow-card">
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={dict.shopping.suggestions}
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
        onChange={(event) => {
          setName(event.target.value);
          setDismissed(false);
          setActive(-1);
        }}
        onFocus={() => setNameFocused(true)}
        onBlur={() => setNameFocused(false)}
        onKeyDown={onNameKeyDown}
        placeholder={dict.add.itemName}
        aria-label={dict.add.itemName}
        enterKeyHint="done"
        maxLength={120}
        className="h-14 min-w-0 flex-1 bg-transparent ps-2.5 text-[17px] outline-none placeholder:text-label-tertiary"
      />
      {showQuantity && (
        <input
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          placeholder={dict.shopping.quantity}
          aria-label={dict.add.itemNote}
          enterKeyHint="done"
          maxLength={40}
          className="h-9 w-[4.75rem] shrink-0 rounded-full bg-fill text-center text-[17px] outline-none placeholder:text-label-tertiary"
        />
      )}
      <button
        type="submit"
        disabled={!name.trim()}
        aria-label={dict.add.submit}
        className="flex size-11 shrink-0 items-center justify-center rounded-full transition-transform duration-100 ease-[var(--ease-out-strong)] active:scale-[0.97] disabled:opacity-35"
      >
        <span className="flex size-[26px] items-center justify-center rounded-full bg-green text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.28)]">
          <Plus size={18} strokeWidth={2.75} />
        </span>
      </button>
    </form>
  );
}
