"use client";

import { useEffect, useId, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Plus } from "lucide-react";
import { CartModel } from "@/components/shopping/cart-model";
import { useI18n } from "@/i18n/dictionary-provider";
import { centerOf, subscribeCartDrops } from "@/lib/cart-drop";
import { grocerySuggestions, type GroceryHint } from "@/lib/groceries";
import { easeOut } from "@/lib/motion";

type Point = { x: number; y: number };
type Toss = { id: number; name: string; from: Point; to: Point };

let tossId = 0;

export function CartBanner({
  history,
  onAdd,
}: {
  history: GroceryHint[];
  onAdd: (name: string, note: string | null, from: Point) => void;
}) {
  const { dict, locale } = useI18n();
  const reduce = useReducedMotion();
  const rawId = useId().replace(/:/g, "");
  const listId = `${rawId}-suggestions`;
  const basketRef = useRef<HTMLSpanElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [nameFocused, setNameFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [active, setActive] = useState(-1);
  const [tosses, setTosses] = useState<Toss[]>([]);
  const suggestions = grocerySuggestions(locale, name, history, quantity);
  const open = nameFocused && !dismissed && suggestions.length > 0;
  const showQuantity = name.trim().length > 0 || quantity.trim().length > 0;

  useEffect(() => {
    return subscribeCartDrops((drop) => {
      const basket = centerOf(basketRef.current);
      if (!basket) return;
      const next: Toss = { id: ++tossId, name: drop.name, from: drop.from, to: basket };
      setTosses((current) => [...current, next]);
    });
  }, []);

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
    const note = quantity.trim() || null;
    const from = centerOf(inputRef.current);
    if (!clean || !from) return;
    onAdd(clean, note, from);
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
    <div className="flex flex-col gap-2">
      <div className="relative mx-auto h-52 w-full max-w-md">
        <CartModel />
        <span ref={basketRef} className="pointer-events-none absolute h-[28%] w-[34%]" style={{ left: "33%", top: "22%" }} />
      </div>
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
      {tosses.map((toss) => (
        <TossChip
          key={toss.id}
          name={toss.name}
          from={toss.from}
          to={toss.to}
          reduce={Boolean(reduce)}
          onDone={() => setTosses((current) => current.filter((item) => item.id !== toss.id))}
        />
      ))}
    </div>
  );
}

function TossChip({
  name,
  from,
  to,
  reduce,
  onDone,
}: {
  name: string;
  from: Point;
  to: Point;
  reduce: boolean;
  onDone: () => void;
}) {
  const dx = Math.round(to.x - from.x);
  const dy = Math.round(to.y - from.y);
  const lift = Math.round(dy - 48);
  const start = "translate(-50%, -50%) scale(0.96)";
  const mid = `translate(calc(-50% + ${Math.round(dx * 0.5)}px), calc(-50% + ${lift}px)) scale(1)`;
  const end = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.7)`;

  return (
    <motion.span
      aria-hidden
      className="pointer-events-none fixed z-[80] max-w-36 truncate rounded-full bg-surface px-3 py-1.5 text-[13px] font-semibold text-label shadow-card"
      style={{ left: from.x, top: from.y }}
      initial={{ opacity: 0, transform: reduce ? end : start }}
      animate={
        reduce
          ? { opacity: [0, 1, 0], transform: end }
          : { opacity: [0, 1, 0], transform: [start, mid, end] }
      }
      transition={{ duration: reduce ? 0.2 : 0.32, ease: easeOut, times: [0, 0.55, 1] }}
      onAnimationComplete={onDone}
    >
      {name}
    </motion.span>
  );
}

