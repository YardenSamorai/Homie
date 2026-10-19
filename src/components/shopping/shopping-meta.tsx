"use client";

import { ProgressRing } from "@/components/ui/progress-ring";
import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
import { useHousehold } from "@/lib/household-store";

export function ShoppingMeta() {
  const { dict } = useI18n();
  const shopping = useHousehold((s) => s.shopping);
  const left = shopping.filter((item) => !item.checkedAt).length;
  const bought = shopping.length - left;
  const progress = shopping.length === 0 ? 0 : bought / shopping.length;
  const label =
    shopping.length === 0
      ? dict.shopping.empty
      : left === 0
        ? dict.shopping.allBought
        : left === 1
          ? dict.shopping.leftOne
          : format(dict.shopping.left, { count: left });

  return (
    <span className="flex items-center gap-2">
      {shopping.length > 0 && (
        <ProgressRing value={progress} size={22} stroke={2.5} color="var(--green)" />
      )}
      <span>{label}</span>
    </span>
  );
}
