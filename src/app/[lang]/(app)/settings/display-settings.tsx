"use client";

import { useId, useRef } from "react";
import { Check } from "lucide-react";
import { localeDirection } from "@/i18n/config";
import { useI18n } from "@/i18n/dictionary-provider";
import {
  nearestTextSize,
  setBoldText,
  setTextSize,
  setTint,
  textSizes,
  tints,
  useBoldText,
  useTextSize,
  useTint,
  type Tint,
} from "@/lib/display";

const swatch: Record<Tint, string> = {
  sage: "bg-tint-sage",
  coral: "bg-tint-coral",
  teal: "bg-tint-teal",
  indigo: "bg-tint-indigo",
  plum: "bg-tint-plum",
};

export function DisplaySettings() {
  return (
    <div className="divide-y divide-separator border-t border-separator">
      <TextSizeRow />
      <TintRow />
      <BoldRow />
    </div>
  );
}

function TextSizeRow() {
  const { locale, dict } = useI18n();
  const dir = localeDirection[locale];
  const size = useTextSize();
  const trackRef = useRef<HTMLDivElement>(null);
  const index = textSizes.indexOf(size);
  const mark = locale === "he" ? "א" : "A";

  const fractionFrom = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return index / (textSizes.length - 1);
    const raw = (clientX - rect.left) / rect.width;
    return dir === "rtl" ? 1 - raw : raw;
  };

  const choose = (fraction: number) => setTextSize(nearestTextSize(fraction));

  const step = (delta: number) => {
    const next = textSizes[Math.min(textSizes.length - 1, Math.max(0, index + delta))];
    if (next) setTextSize(next);
  };

  return (
    <div className="flex flex-col gap-2 px-4 py-3">
      <p className="text-[17px]">{dict.settings.textSize}</p>
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label={dict.settings.textSize}
        aria-valuemin={0}
        aria-valuemax={textSizes.length - 1}
        aria-valuenow={index}
        aria-valuetext={dict.settings.textSizes[size]}
        aria-orientation="horizontal"
        className="flex h-11 touch-none items-center gap-3 outline-none"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          choose(fractionFrom(event.clientX));
        }}
        onPointerMove={(event) => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
          choose(fractionFrom(event.clientX));
        }}
        onKeyDown={(event) => {
          const enlarge = dir === "rtl" ? "ArrowLeft" : "ArrowRight";
          const shrink = dir === "rtl" ? "ArrowRight" : "ArrowLeft";
          if (event.key === enlarge || event.key === "ArrowUp") {
            event.preventDefault();
            step(1);
          } else if (event.key === shrink || event.key === "ArrowDown") {
            event.preventDefault();
            step(-1);
          } else if (event.key === "Home") {
            event.preventDefault();
            setTextSize("0");
          } else if (event.key === "End") {
            event.preventDefault();
            setTextSize("4");
          }
        }}
      >
        <span aria-hidden className="w-4 text-center text-[13px] font-medium text-label-secondary">
          {mark}
        </span>
        <span className="relative h-1 flex-1 rounded-full bg-fill">
          <span
            aria-hidden
            className="absolute top-1/2 size-7 -translate-y-1/2 rounded-full bg-surface shadow-[0_3px_8px_rgb(40_30_20/0.16),0_1px_1px_rgb(40_30_20/0.06)] ring-1 ring-separator"
            style={{ insetInlineStart: `calc(${index} * (100% - 1.75rem) / ${textSizes.length - 1})` }}
          />
        </span>
        <span aria-hidden className="w-5 text-center text-[22px] font-semibold leading-none">
          {mark}
        </span>
      </div>
    </div>
  );
}

function TintRow() {
  const { dict } = useI18n();
  const tint = useTint();

  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      <p className="text-[17px]">{dict.settings.tint}</p>
      <div role="radiogroup" aria-label={dict.settings.tint} className="flex items-center justify-between">
        {tints.map((option) => {
          const selected = option === tint;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={dict.settings.tints[option]}
              onClick={() => setTint(option)}
              className={`flex size-11 items-center justify-center rounded-full ${swatch[option]} text-white transition-transform duration-150 ease-out active:scale-[0.97] ${
                selected ? "ring-2 ring-label ring-offset-2 ring-offset-surface" : ""
              }`}
            >
              {selected && <Check aria-hidden size={18} strokeWidth={2.5} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BoldRow() {
  const { dict } = useI18n();
  const bold = useBoldText();
  const labelId = useId();

  return (
    <div className="flex min-h-14 items-center justify-between gap-3 px-4">
      <span id={labelId} className="text-[17px]">
        {dict.settings.boldText}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={bold}
        aria-labelledby={labelId}
        onClick={() => setBoldText(!bold)}
        className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200 ease-[var(--ease-out-strong)] active:scale-[0.97] ${
          bold ? "bg-accent" : "bg-fill"
        }`}
      >
        <span
          aria-hidden
          className={`absolute top-[2px] size-[27px] rounded-full bg-white shadow-[0_3px_8px_rgb(40_30_20/0.16),0_1px_1px_rgb(40_30_20/0.06)] transition-[inset-inline-start] duration-200 ease-[var(--ease-out-strong)] motion-reduce:transition-none ${
            bold ? "start-[22px]" : "start-[2px]"
          }`}
        />
      </button>
    </div>
  );
}
