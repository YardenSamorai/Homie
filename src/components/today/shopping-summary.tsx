"use client";

import { ProgressRing } from "@/components/ui/progress-ring";
import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
import { useHousehold } from "@/lib/household-store";

export function ShoppingProgress({ children }: { children: React.ReactNode }) {
  const shopping = useHousehold((s) => s.shopping);
  const left = shopping.filter((item) => !item.checkedAt).length;
  const progress = shopping.length === 0 ? 0 : (shopping.length - left) / shopping.length;
  if (shopping.length === 0) return children;
  return (
    <ProgressRing value={progress} size={42} stroke={2.5} color="var(--green)">
      {children}
    </ProgressRing>
  );
}

export function ShoppingSummary() {
  const { dict } = useI18n();
  const left = useHousehold((s) => s.shopping.filter((item) => !item.checkedAt).length);

  return (
    <span className="text-[13px] text-label-secondary">
      {left === 0 ? dict.today.shoppingEmpty : left === 1 ? dict.today.shoppingOne : format(dict.today.shoppingLeft, { count: left })}
    </span>
  );
}
