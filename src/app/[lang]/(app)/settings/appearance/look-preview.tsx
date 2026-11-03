"use client";

import type { CSSProperties, ReactNode } from "react";
import { Check, Plus } from "lucide-react";
import { useI18n } from "@/i18n/dictionary-provider";
import { lookTokens, type Look } from "@/lib/look";
import type { Period } from "@/lib/period";

/** The data-* attributes and variables that draw a look, for any element: a preview, a theme card, a swatch. */
export function lookProps(look: Look, photoUrl: string | null = null, { zoom = false }: { zoom?: boolean } = {}) {
  const tokens = lookTokens(look);
  const attrs = Object.fromEntries(Object.entries(tokens.attrs).map(([name, value]) => [`data-${name}`, value]));
  const style = { ...tokens.vars, ...(photoUrl ? { "--bg-photo": `url("${photoUrl}")` } : {}) } as CSSProperties;
  return { attrs, style, zoom: zoom ? tokens.zoom : 1 };
}

/** A small piece of a look: its page, background and cards, for choosing between themes, backgrounds and cards. */
export function LookSwatch({ look, photoUrl, period, className = "", children }: { look: Look; photoUrl?: string | null; period: Period; className?: string; children?: ReactNode }) {
  const { attrs, style } = lookProps(look, photoUrl ?? null);
  return (
    <div data-preview {...attrs} data-period={period} style={style} className={`relative isolate overflow-hidden ${className}`}>
      <div aria-hidden className="backdrop" />
      <div aria-hidden className="atmosphere inset-0! h-full!" data-period={period} />
      {children}
    </div>
  );
}

/**
 * How Homie will look with these choices, drawn with the app's own styles on sample content: a title, an event,
 * a task that's late (the warning color never follows the accent), a choice and the main button.
 */
export function LookPreview({ look, photoUrl, period, frame, height }: { look: Look; photoUrl: string | null; period: Period; frame: "phone" | "desktop"; height: string }) {
  const { dict } = useI18n();
  const copy = dict.look.sample;
  const { attrs, style, zoom } = lookProps(look, photoUrl, { zoom: true });
  return (
    <div
      data-preview
      {...attrs}
      data-period={period}
      style={style}
      role="img"
      aria-label={dict.look.previewLabel}
      className={`relative isolate mx-auto w-full overflow-hidden rounded-[22px] ring-1 ring-separator ${height} ${
        frame === "phone" ? "max-w-[300px]" : "max-w-full"
      }`}
    >
      <div aria-hidden className="backdrop" />
      <div aria-hidden className="atmosphere" data-period={period} />
      <div style={{ zoom }} className={`relative flex flex-col gap-stack p-4 ${frame === "desktop" ? "md:px-8 md:pt-6" : ""}`}>
        <div>
          <p className="text-[13px] font-semibold text-label/60">{copy.eyebrow}</p>
          <p className="mt-0.5 text-[26px] font-bold leading-tight tracking-tight">{copy.greeting}</p>
        </div>
        <div className={frame === "desktop" ? "grid grid-cols-2 gap-3" : "flex flex-col gap-3"}>
          <div className="overflow-hidden rounded-card bg-surface shadow-card">
            <div className="flex items-center gap-3 px-3.5 py-row">
              <span aria-hidden className="h-9 w-1 shrink-0 rounded-full bg-indigo" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px] font-semibold">{copy.event}</span>
                <span className="text-[13px] tabular-nums text-label-secondary">{copy.eventTime}</span>
              </span>
              <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-indigo text-[12px] font-semibold text-white">
                {copy.initial}
              </span>
            </div>
            <div className="flex items-center gap-3 border-t border-separator px-3.5 py-row">
              <span aria-hidden className="flex size-[22px] shrink-0 items-center justify-center rounded-full ring-[1.5px] ring-accent" />
              <span className="min-w-0 flex-1 truncate text-[15px]">{copy.task}</span>
              <span className="shrink-0 rounded-full bg-[color-mix(in_oklab,var(--danger)_14%,transparent)] px-2 py-0.5 text-[12px] font-semibold text-danger">{copy.late}</span>
            </div>
            <div className="flex items-center gap-3 border-t border-separator px-3.5 py-row">
              <span aria-hidden className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-accent text-accent-contrast">
                <Check size={14} strokeWidth={3} />
              </span>
              <span className="min-w-0 flex-1 truncate text-[15px] text-label-secondary line-through">{copy.done}</span>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div aria-hidden className="flex flex-1 rounded-[9px] bg-fill p-0.5">
              <span className="flex min-h-8 flex-1 items-center justify-center rounded-[7px] bg-segment-thumb text-[13px] font-semibold shadow-[0_3px_8px_rgb(40_30_20/0.12)]">
                {copy.today}
              </span>
              <span className="flex min-h-8 flex-1 items-center justify-center text-[13px] font-semibold">{copy.tomorrow}</span>
            </div>
            <span aria-hidden className="flex h-10 items-center gap-1.5 rounded-full bg-accent px-4 text-[15px] font-semibold text-accent-contrast">
              <Plus size={16} strokeWidth={2.5} />
              {copy.button}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
