"use client";

import { useId } from "react";

export function OtpInput({
  value,
  onChange,
  error,
  disabled,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  disabled?: boolean;
  label: string;
}) {
  const id = useId();
  const digits = value.replace(/\D/g, "").slice(0, 6).split("");

  return (
    <div>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className="relative" dir="ltr">
        <input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={6}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="absolute inset-0 z-10 cursor-text bg-transparent text-[16px] text-transparent caret-transparent"
        />
        <div className="pointer-events-none grid grid-cols-6 gap-2" aria-hidden>
          {Array.from({ length: 6 }, (_, i) => (
            <span
              key={i}
              className={`flex h-14 items-center justify-center rounded-xl bg-surface text-[22px] font-semibold tabular-nums shadow-card ring-1 ${
                error
                  ? "ring-danger/40"
                  : digits.length === i
                    ? "ring-accent"
                    : "ring-[light-dark(rgb(40_30_20/0.04),rgb(255_255_255/0.06))]"
              }`}
            >
              {digits[i] ?? ""}
            </span>
          ))}
        </div>
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-2 text-[13px] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
