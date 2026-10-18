"use client";

import { useId } from "react";
import { motion } from "motion/react";
import { spring } from "@/lib/motion";

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const thumbId = useId();

  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-[9px] bg-fill p-0.5">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className="relative min-h-8 flex-1 rounded-[7px] px-3 text-[13px] font-semibold before:absolute before:inset-x-0 before:-inset-y-1.5"
          >
            {selected && (
              <motion.span
                layoutId={thumbId}
                transition={spring.snappy}
                className="absolute inset-0 rounded-[7px] bg-segment-thumb shadow-[0_3px_8px_rgb(40_30_20/0.12),0_3px_1px_rgb(40_30_20/0.04)]"
              />
            )}
            <span className="relative z-10">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
