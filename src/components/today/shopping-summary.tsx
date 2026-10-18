"use client";

import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
import { useHousehold } from "@/lib/household-store";

export function ShoppingSummary() {
  const { dict } = useI18n();
  const left = useHousehold((s) => s.shopping.filter((item) => !item.checkedAt).length);

  return (
    <span className="text-[13px] text-label-secondary">
      {left === 0 ? dict.today.shoppingEmpty : left === 1 ? dict.today.shoppingOne : format(dict.today.shoppingLeft, { count: left })}
    </span>
  );
}
