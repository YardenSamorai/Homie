"use client";

import { useId, useState, type Ref } from "react";
import { motion, useReducedMotion } from "motion/react";

export const CODE_LENGTH = 6;

export type OtpState = "idle" | "error" | "success";

/**
 * One real input under six painted cells, so paste, SMS/email autofill, and the numeric keyboard
 * all behave natively. The cells are only a picture of the value.
 */
export function OtpInput({
  value,
  onChange,
  state = "idle",
  shake = 0,
  disabled,
  label,
  describedBy,
  inputRef,
}: {
  value: string;
  onChange: (value: string) => void;
  state?: OtpState;
  /** Bump to shake the cells once. */
  shake?: number;
  disabled?: boolean;
  label: string;
  describedBy?: string;
  inputRef?: Ref<HTMLInputElement>;
}) {
  const id = useId();
  const reduce = useReducedMotion();
  const [focused, setFocused] = useState(false);
  const digits = value.split("");
  const active = Math.min(value.length, CODE_LENGTH - 1);

  return (
    <div className="relative" dir="ltr">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        name="one-time-code"
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="go"
        disabled={disabled}
        aria-invalid={state === "error" ? true : undefined}
        aria-describedby={describedBy}
        // The cells show focus themselves; the global focus outline would box the whole row.
        style={{ outline: "none" }}
        className="absolute inset-0 z-10 w-full cursor-text bg-transparent text-[16px] text-transparent caret-transparent selection:bg-transparent"
      />
      <motion.div
        key={shake}
        initial={false}
        animate={
          shake && !reduce
            ? { transform: ["translateX(0px)", "translateX(-10px)", "translateX(9px)", "translateX(-6px)", "translateX(3px)", "translateX(0px)"] }
            : { transform: "translateX(0px)" }
        }
        transition={{ duration: 0.42, ease: "easeOut" }}
        aria-hidden
        className="pointer-events-none flex items-center gap-2"
      >
        {Array.from({ length: CODE_LENGTH }, (_, i) => {
          const digit = digits[i];
          const current = focused && i === active && value.length < CODE_LENGTH && state !== "success";
          const tone =
            state === "success"
              ? "bg-accent text-accent-contrast ring-accent"
              : state === "error"
                ? "bg-surface text-label ring-danger/55"
                : current
                  ? "bg-surface text-label ring-2 ring-accent"
                  : "bg-surface text-label ring-[light-dark(rgb(40_30_20/0.09),rgb(255_255_255/0.1))]";
          return (
            <span key={i} className={`contents`}>
              {i === CODE_LENGTH / 2 && <span className="mx-0.5 h-0.5 w-2.5 shrink-0 rounded-full bg-label-tertiary/60" />}
              <span
                className={`relative flex h-[3.75rem] min-w-0 flex-1 items-center justify-center rounded-[16px] text-[26px] font-semibold tabular-nums shadow-[0_6px_16px_-10px_rgb(40_30_20/0.25)] ring-1 transition-[background-color,color,box-shadow] duration-200 ease-[var(--ease-out-strong)] ${tone}`}
                style={{ transitionDelay: state === "success" ? `${i * 45}ms` : "0ms" }}
              >
                {digit ? (
                  <motion.span
                    key={`${i}-${digit}`}
                    initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(6px) scale(0.85)" }}
                    animate={{ opacity: 1, transform: "translateY(0px) scale(1)" }}
                    transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                  >
                    {digit}
                  </motion.span>
                ) : current ? (
                  <span className="otp-caret h-7 w-[2px] rounded-full bg-accent" />
                ) : null}
              </span>
            </span>
          );
        })}
      </motion.div>
    </div>
  );
}
