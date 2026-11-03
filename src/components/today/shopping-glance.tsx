"use client";

import Link from "next/link";
import { Plus, ShoppingBasket } from "lucide-react";
import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
import type { ShoppingItem } from "@/lib/household";
import { useAddSheet } from "@/lib/household-store";

const PREVIEW = 3;

/** The list in one glance: how much is waiting and the first few names, with the way in and a quick add. */
export function ShoppingGlance({ items, compact = false, fallback = null }: { items: ShoppingItem[]; compact?: boolean; fallback?: React.ReactNode }) {
  const { locale, dict } = useI18n();
  const show = useAddSheet((s) => s.show);
  const waiting = items.filter((item) => !item.checkedAt).sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
  if (waiting.length === 0) return fallback;
  const names = waiting.slice(0, PREVIEW).map((item) => item.name);
  const rest = waiting.length - names.length;

  return (
    <section aria-label={dict.today.shopping} className="flex items-stretch overflow-hidden rounded-card bg-surface shadow-card ring-1 ring-hairline">
      <Link
        href={`/${locale}/shopping`}
        className="flex min-w-0 flex-1 items-center gap-3 py-3 ps-4 pe-2 transition-colors duration-150 active:bg-fill"
      >
        <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--green)_16%,transparent)] text-green">
          <ShoppingBasket size={18} strokeWidth={2.25} />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-[16px] font-semibold">
            {waiting.length === 1 ? dict.today.shoppingOne : format(dict.today.shoppingLeft, { count: waiting.length })}
          </span>
          {!compact && (
            <span className="line-clamp-2 text-[14px] leading-snug text-label-secondary [overflow-wrap:anywhere]">
              <bdi>{names.join(dict.agenda.listJoin)}</bdi>
              {rest > 0 && ` ${format(dict.agenda.andMore, { count: rest })}`}
            </span>
          )}
        </span>
      </Link>
      <button
        type="button"
        onClick={() => show("shopping")}
        aria-label={dict.today.quickAdd}
        className="flex w-14 shrink-0 items-center justify-center text-accent transition-transform duration-150 ease-out active:scale-[0.94]"
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-fill">
          <Plus aria-hidden size={18} strokeWidth={2.5} />
        </span>
      </button>
    </section>
  );
}
