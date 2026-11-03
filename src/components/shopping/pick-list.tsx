"use client";

import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { CheckCircle } from "@/components/ui/check-circle";
import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";

export type PickLine = {
  key: string;
  name: string;
  /** The amount and note, or why it's offered. */
  detail?: string | null;
  /** Already on the list: shown, but not picked unless someone insists. */
  onList?: boolean;
  trailing?: ReactNode;
};

/** Products to pick before adding them: a check per line, and a quiet mark on what's already on the list. */
export function PickList({
  lines,
  picked,
  onToggle,
  label,
}: {
  lines: PickLine[];
  picked: ReadonlySet<string>;
  onToggle: (key: string) => void;
  label: string;
}) {
  const { dict } = useI18n();
  return (
    <ul aria-label={label} className="overflow-hidden rounded-xl bg-surface">
      {lines.map((line) => {
        const on = picked.has(line.key);
        return (
          <li key={line.key} className="flex min-h-12 items-center gap-1 border-b border-separator pe-2 last:border-b-0">
            <button
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => onToggle(line.key)}
              className="flex min-h-12 min-w-0 flex-1 items-center gap-3 ps-3 text-start"
            >
              <CheckCircle checked={on} color="var(--green)" />
              <span className="flex min-w-0 flex-1 flex-col py-2">
                <span dir="auto" className="truncate text-[17px]">
                  {line.name}
                </span>
                {(line.detail || line.onList) && (
                  <span className="flex items-center gap-1 truncate text-[13px] text-label-secondary">
                    {line.onList && (
                      <>
                        <Check aria-hidden size={13} strokeWidth={2.5} className="shrink-0 text-green" />
                        {dict.shopping.onList}
                        {line.detail && " · "}
                      </>
                    )}
                    {line.detail}
                  </span>
                )}
              </span>
            </button>
            {line.trailing}
          </li>
        );
      })}
    </ul>
  );
}

/** The selection a pick list starts with: everything not already on the list. */
export const notOnList = (lines: PickLine[]) => new Set(lines.filter((line) => !line.onList).map((line) => line.key));

export function usePickCopy() {
  const { dict } = useI18n();
  return (count: number) =>
    count === 0 ? dict.add.submit : count === 1 ? dict.shopping.addOne : format(dict.shopping.addCount, { count });
}
