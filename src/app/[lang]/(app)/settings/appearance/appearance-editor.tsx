"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Drawer } from "@base-ui/react/drawer";
import { Check, ImagePlus, Maximize2, Minimize2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Sheet, SheetBody } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { localeDirection } from "@/i18n/config";
import { useI18n } from "@/i18n/dictionary-provider";
import { useAuth } from "@/lib/auth/session";
import { normalizeHex } from "@/lib/color";
import {
  accentPresets,
  accentSet,
  backgroundKinds,
  cardStyles,
  defaultLook,
  densities,
  fonts,
  gradients,
  isCustomized,
  lookThemes,
  modes,
  motions,
  textSizes,
  themeDefaults,
  withTheme,
  type Background,
  type BackgroundKind,
  type Look,
  type LookTheme,
  type TextSize,
} from "@/lib/look";
import { easeOut } from "@/lib/motion";
import { periodFor, type Period } from "@/lib/period";
import { usePrefs } from "@/lib/prefs-store";
import { removeBackgrounds } from "@/lib/supabase/media";
import { useLook } from "@/lib/theme";
import { useClock } from "@/lib/use-clock";
import { LookPreview, LookSwatch } from "./look-preview";
import { PhotoEditor, usePhotoUrl } from "./photo-editor";

type Status = "idle" | "saving" | "saved" | "failed" | "offline";

const sameLook = (a: Look, b: Look) => JSON.stringify(a) === JSON.stringify(b);
const hint = "px-4 pb-3 pt-1 text-[13px] leading-snug text-label-secondary";
const periods: Period[] = ["morning", "afternoon", "evening", "night"];
const pair = ([light, dark]: [string, string]) => `light-dark(${light}, ${dark})`;
const tile = "relative rounded-xl text-start outline-offset-2 ring-2 ring-transparent transition-[box-shadow,scale] duration-150 ease-out active:scale-[0.97] aria-checked:ring-accent";

const subscribeMedia = (query: string) => (onChange: () => void) => {
  const media = window.matchMedia(query);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
};
function useMedia(query: string) {
  return useSyncExternalStore(subscribeMedia(query), () => window.matchMedia(query).matches, () => false);
}
const subscribeNever = () => () => {};
const glassWorks = () =>
  (CSS.supports("backdrop-filter", "blur(1px)") || CSS.supports("-webkit-backdrop-filter", "blur(1px)")) &&
  !window.matchMedia("(prefers-reduced-transparency: reduce)").matches;

/** Choosing away from Settings with changes not saved: save them, drop them, or stay. */
function useLeaveGuard(dirty: boolean, onLeave: (href: string) => void) {
  useEffect(() => {
    if (!dirty) return;
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, location.href);
      if (url.origin !== location.origin || url.pathname === location.pathname) return;
      event.preventDefault();
      event.stopPropagation();
      onLeave(`${url.pathname}${url.search}${url.hash}`);
    };
    const onUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [dirty, onLeave]);
}

function Radio({ selected, label, onSelect, className = "", children }: { selected: boolean; label: string; onSelect: () => void; className?: string; children: React.ReactNode }) {
  return (
    <button type="button" role="radio" aria-checked={selected} aria-label={label} onClick={onSelect} className={`${tile} ${className}`}>
      {children}
    </button>
  );
}

function TextSizeSlider({ value, onChange }: { value: TextSize; onChange: (size: TextSize) => void }) {
  const { locale, dict } = useI18n();
  const dir = localeDirection[locale];
  const track = useRef<HTMLDivElement>(null);
  const index = textSizes.indexOf(value);
  const mark = locale === "he" ? "א" : "A";
  const last = textSizes.length - 1;
  const at = (i: number) => textSizes[Math.min(last, Math.max(0, i))];
  const fromX = (clientX: number) => {
    const rect = track.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return value;
    const raw = (clientX - rect.left) / rect.width;
    return at(Math.round((dir === "rtl" ? 1 - raw : raw) * last));
  };
  return (
    <div
      ref={track}
      role="slider"
      tabIndex={0}
      aria-label={dict.look.textTitle}
      aria-valuemin={0}
      aria-valuemax={last}
      aria-valuenow={index}
      aria-valuetext={dict.look.textSizes[value]}
      aria-orientation="horizontal"
      className="flex h-11 touch-none items-center gap-3 rounded-lg outline-none focus-visible:outline-2 focus-visible:outline-accent"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        onChange(fromX(event.clientX));
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) onChange(fromX(event.clientX));
      }}
      onKeyDown={(event) => {
        const enlarge = dir === "rtl" ? "ArrowLeft" : "ArrowRight";
        const shrink = dir === "rtl" ? "ArrowRight" : "ArrowLeft";
        const next =
          event.key === enlarge || event.key === "ArrowUp"
            ? at(index + 1)
            : event.key === shrink || event.key === "ArrowDown"
              ? at(index - 1)
              : event.key === "Home"
                ? at(0)
                : event.key === "End"
                  ? at(last)
                  : null;
        if (!next) return;
        event.preventDefault();
        onChange(next);
      }}
    >
      <span aria-hidden className="w-4 text-center text-[13px] font-medium text-label-secondary">
        {mark}
      </span>
      <span className="relative h-1 flex-1 rounded-full bg-fill">
        <span
          aria-hidden
          className="absolute top-1/2 size-7 -translate-y-1/2 rounded-full bg-surface shadow-[0_3px_8px_rgb(40_30_20/0.16),0_1px_1px_rgb(40_30_20/0.06)] ring-1 ring-separator"
          style={{ insetInlineStart: `calc(${index} * (100% - 1.75rem) / ${last})` }}
        />
      </span>
      <span aria-hidden className="w-5 text-center text-[22px] font-semibold leading-none">
        {mark}
      </span>
    </div>
  );
}

/** The accent: the theme's own, one of five, or any color, which is made readable before it's used. */
function AccentPicker({ look, onChange }: { look: Look; onChange: (accent: Look["accent"]) => void }) {
  const { dict } = useI18n();
  const copy = dict.look;
  const picker = useRef<HTMLInputElement>(null);
  const hexId = useId();
  const custom = look.accent.kind === "custom" ? look.accent.hex : null;
  const [text, setText] = useState(custom ?? "");
  const [shown, setShown] = useState(custom);
  const [invalid, setInvalid] = useState(false);
  if (custom !== shown) {
    setShown(custom);
    if (custom) setText(custom);
    setInvalid(false);
  }
  const set = accentSet(look);
  const themeAccent = accentSet({ theme: look.theme, accent: { kind: "theme" } }).accent;
  const commitText = (value: string) => {
    const hex = normalizeHex(value);
    if (hex) onChange({ kind: "custom", hex });
    setInvalid(!hex);
  };
  const ring = "size-11 rounded-full ring-2 ring-offset-2 ring-offset-surface";

  return (
    <>
      <div role="radiogroup" aria-label={copy.accentTitle} className="flex flex-wrap gap-3 p-4">
        <button
          type="button"
          role="radio"
          aria-checked={look.accent.kind === "theme"}
          aria-label={copy.accentTheme}
          onClick={() => onChange({ kind: "theme" })}
          className={`${ring} flex items-center justify-center text-white transition-transform duration-150 ease-out active:scale-[0.97] ${look.accent.kind === "theme" ? "ring-label" : "ring-transparent"}`}
          style={{ background: pair(themeAccent) }}
        >
          {look.accent.kind === "theme" && <Check aria-hidden size={18} strokeWidth={2.5} />}
        </button>
        {accentPresets.map((id) => {
          const selected = look.accent.kind === "preset" && look.accent.id === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={copy.accents[id]}
              onClick={() => onChange({ kind: "preset", id })}
              className={`${ring} flex items-center justify-center text-white transition-transform duration-150 ease-out active:scale-[0.97] ${selected ? "ring-label" : "ring-transparent"}`}
              style={{ background: pair(accentSet({ theme: look.theme, accent: { kind: "preset", id } }).accent) }}
            >
              {selected && <Check aria-hidden size={18} strokeWidth={2.5} />}
            </button>
          );
        })}
        <button
          type="button"
          role="radio"
          aria-checked={Boolean(custom)}
          aria-label={copy.accentCustom}
          onClick={() => picker.current?.click()}
          className={`${ring} relative flex items-center justify-center text-white transition-transform duration-150 ease-out active:scale-[0.97] ${custom ? "ring-label" : "ring-transparent"}`}
          style={{ background: custom ? pair(set.accent) : "conic-gradient(from 0deg, #c0504a, #c49a3a, #5c9a58, #3f8aa0, #5a5f94, #a35d8a, #c0504a)" }}
        >
          {custom && <Check aria-hidden size={18} strokeWidth={2.5} />}
          <input
            ref={picker}
            type="color"
            tabIndex={-1}
            aria-hidden
            value={custom ?? "#527a67"}
            onChange={(event) => onChange({ kind: "custom", hex: event.target.value })}
            className="pointer-events-none absolute inset-0 opacity-0"
          />
        </button>
      </div>
      {custom && (
        <div className="flex flex-col gap-1 border-t border-separator px-4 py-3">
          <label htmlFor={hexId} className="text-[15px]">
            {copy.hexLabel}
          </label>
          <input
            id={hexId}
            dir="ltr"
            value={text}
            maxLength={7}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            enterKeyHint="done"
            aria-invalid={invalid}
            aria-describedby={invalid ? `${hexId}-error` : undefined}
            onChange={(event) => {
              setText(event.target.value);
              if (normalizeHex(event.target.value)) commitText(event.target.value);
            }}
            onBlur={(event) => commitText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") commitText(event.currentTarget.value);
            }}
            className="h-11 w-full rounded-[10px] bg-fill px-3 text-start font-mono text-[17px] uppercase text-label outline-none aria-invalid:ring-2 aria-invalid:ring-danger"
          />
          {invalid && (
            <p id={`${hexId}-error`} role="alert" className="text-[13px] text-danger">
              {copy.hexInvalid}
            </p>
          )}
        </div>
      )}
      {set.adjusted && <p className="px-4 pt-1 text-[13px] leading-snug text-label">{copy.accentAdjusted}</p>}
      <p className={hint}>{copy.accentHint}</p>
    </>
  );
}

/**
 * Settings → Appearance. Everything here is a draft drawn in the preview until Save: Cancel goes back to what's
 * saved, leaving with changes asks first, and a save that fails keeps the draft. Only this parent's view changes.
 */
export function AppearanceEditor() {
  const { dict } = useI18n();
  const copy = dict.look;
  const router = useRouter();
  const userId = useAuth((s) => s.session?.userId) ?? "";
  const saved = useLook();
  const commit = usePrefs((s) => s.commit);
  const [draft, setDraft] = useState(saved);
  const [base, setBase] = useState(saved);
  if (saved !== base) {
    setBase(saved);
    if (sameLook(draft, base)) setDraft(saved);
  }
  const dirty = !sameLook(draft, saved);
  const [status, setStatus] = useState<Status>("idle");
  const [frame, setFrame] = useState<"phone" | "desktop">("phone");
  const [expanded, setExpanded] = useState(false);
  const [skyAt, setSkyAt] = useState<Period | null>(null);
  const [nightAsk, setNightAsk] = useState(false);
  const [panel, setPanel] = useState<BackgroundKind | null>(null);
  const [leaving, setLeaving] = useState<string | null>(null);
  const clock = useClock();
  const period = skyAt ?? (clock ? periodFor(clock.hour) : "morning");
  const photoPath = draft.background.photo?.path ?? null;
  const photoUrl = usePhotoUrl(draft.background.kind === "photo" ? photoPath : null);
  const thumbUrl = usePhotoUrl(photoPath);
  const reduceMotion = useMedia("(prefers-reduced-motion: reduce)");
  const glass = useSyncExternalStore(subscribeNever, glassWorks, () => true);
  useLeaveGuard(dirty, setLeaving);

  const edit = (change: (look: Look) => Look) => {
    setDraft((current) => change(current));
    setStatus("idle");
  };
  const set = (patch: Partial<Look>) => edit((look) => ({ ...look, ...patch }));
  const setBackground = (patch: Partial<Background>) => edit((look) => ({ ...look, background: { ...look.background, ...patch } }));

  const save = async () => {
    setStatus("saving");
    const result = await commit(userId, { ...usePrefs.getState().prefs, look: draft });
    if (result !== "saved") {
      setStatus(result === "offline" ? "offline" : "failed");
      return false;
    }
    setStatus("saved");
    void removeBackgrounds(draft.background.photo?.path ?? null);
    return true;
  };
  const cancel = () => {
    if (draft.background.photo?.path !== saved.background.photo?.path) void removeBackgrounds(saved.background.photo?.path ?? null);
    setDraft(saved);
    setNightAsk(false);
    setStatus("idle");
  };

  const chooseTheme = (theme: LookTheme) => {
    setNightAsk(false);
    if (theme === "night" && draft.mode !== "dark" && draft.theme !== "night") {
      setNightAsk(true);
      return;
    }
    edit((look) => withTheme(look, theme));
  };

  const chooseBackground = (kind: BackgroundKind) => {
    setPanel(kind);
    if (kind === "photo" && !draft.background.photo) return;
    setBackground({ kind });
  };
  const shownPanel = panel ?? draft.background.kind;
  const customized = isCustomized(draft);
  const message =
    status === "saving"
      ? copy.saving
      : status === "failed"
        ? copy.saveFailed
        : status === "offline"
          ? copy.offline
          : dirty
            ? copy.unsaved
            : status === "saved"
              ? copy.saved
              : "";

  return (
    <div className="flex flex-col gap-stack @3xl:grid @3xl:grid-cols-[minmax(0,1fr)_minmax(0,21rem)] @3xl:items-start @3xl:gap-8">
      <aside aria-label={copy.preview} className="sticky top-[calc(env(safe-area-inset-top)+0.5rem)] z-10 -mx-1 bg-bg px-1 pb-2 lg:top-4 @3xl:order-last @3xl:top-10 @3xl:mx-0 @3xl:px-0">
        <div className={`relative mx-auto w-full ${frame === "phone" ? "max-w-[300px]" : ""}`}>
          <LookPreview look={draft} photoUrl={photoUrl} period={period} frame={frame} height={`${expanded ? "h-[380px]" : "h-[188px]"} @3xl:h-[460px]`} />
          <button
            type="button"
            onClick={() => setExpanded((open) => !open)}
            aria-pressed={expanded}
            aria-label={expanded ? copy.collapse : copy.expand}
            className="absolute end-1 top-1 flex size-11 items-center justify-center rounded-full text-label transition-transform duration-150 ease-out active:scale-[0.94] @3xl:hidden"
          >
            <span aria-hidden className="material flex size-8 items-center justify-center rounded-full shadow-[0_2px_8px_rgb(30_40_35/0.14)]">
              {expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </span>
          </button>
        </div>
        <div className="mt-2 hidden items-center gap-2 lg:flex">
          <div className="w-44">
            <SegmentedControl
              label={copy.frame}
              value={frame}
              onChange={setFrame}
              options={[
                { value: "phone", label: copy.phone },
                { value: "desktop", label: copy.desktop },
              ]}
            />
          </div>
          <p className="min-w-0 flex-1 text-[13px] leading-snug text-label-secondary">{copy.previewHint}</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col gap-8">
        <Card title={copy.themeTitle}>
          <div role="radiogroup" aria-label={copy.themeTitle} className="grid grid-cols-2 gap-3 p-3">
            {lookThemes.map((theme) => {
              const selected = draft.theme === theme;
              return (
                <Radio key={theme} selected={selected} label={copy.themes[theme]} onSelect={() => chooseTheme(theme)} className="flex flex-col gap-2 p-1.5">
                  <LookSwatch look={withTheme(draft, theme)} period={period} className="h-20 w-full rounded-[10px]">
                    <div className="absolute inset-x-2.5 bottom-2.5 top-5 flex flex-col justify-center gap-1.5 rounded-[10px] bg-surface px-2.5 shadow-card">
                      <span className="h-1.5 w-10 rounded-full bg-accent" />
                      <span className="h-1.5 w-16 rounded-full bg-label/15" />
                    </div>
                  </LookSwatch>
                  <span className="flex flex-col px-1 pb-0.5">
                    <span className="flex items-center gap-1.5 text-[15px] font-semibold">
                      {copy.themes[theme]}
                      {selected && customized && (
                        <span className="rounded-full bg-fill px-1.5 py-px text-[11px] font-semibold text-label-secondary">{copy.customized}</span>
                      )}
                    </span>
                    <span className="text-[13px] leading-snug text-label-secondary">{copy.themeLeads[theme]}</span>
                  </span>
                </Radio>
              );
            })}
          </div>
          {nightAsk && (
            <div role="group" aria-label={copy.nightTitle} className="mx-3 mb-3 flex flex-col gap-2 rounded-xl bg-fill p-3">
              <p className="text-[15px] font-semibold">{copy.nightTitle}</p>
              <p className="text-[13px] leading-snug text-label-secondary">{copy.nightBody}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setNightAsk(false);
                    edit((look) => ({ ...withTheme(look, "night"), mode: "dark" }));
                  }}
                  className="min-h-11 rounded-full bg-accent px-4 text-[15px] font-semibold text-accent-contrast transition-transform duration-150 ease-out active:scale-[0.97]"
                >
                  {copy.nightDark}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNightAsk(false);
                    edit((look) => withTheme(look, "night"));
                  }}
                  className="min-h-11 rounded-full bg-surface px-4 text-[15px] font-semibold transition-transform duration-150 ease-out active:scale-[0.97]"
                >
                  {copy.nightKeep}
                </button>
              </div>
            </div>
          )}
          <p className={hint}>{copy.themeHint}</p>
        </Card>

        <Card title={copy.modeTitle}>
          <div className="p-3">
            <SegmentedControl label={copy.modeTitle} value={draft.mode} onChange={(mode) => set({ mode })} options={modes.map((value) => ({ value, label: copy.modes[value] }))} />
          </div>
          <p className={hint}>{copy.modeSystemHint}</p>
        </Card>

        <Card title={copy.accentTitle}>
          <AccentPicker look={draft} onChange={(accent) => set({ accent })} />
        </Card>

        <Card title={copy.backgroundTitle}>
          <div role="radiogroup" aria-label={copy.backgroundTitle} className="grid grid-cols-3 gap-2.5 p-3">
            {backgroundKinds.map((kind) => {
              const selected = draft.background.kind === kind;
              return (
                <Radio key={kind} selected={selected} label={copy.backgrounds[kind]} onSelect={() => chooseBackground(kind)} className="flex flex-col gap-1.5 p-1">
                  {kind === "photo" ? (
                    <span className="relative flex h-14 w-full items-center justify-center overflow-hidden rounded-[9px] bg-fill text-label-secondary">
                      {thumbUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumbUrl} alt="" className="absolute inset-0 size-full object-cover" />
                      ) : (
                        <ImagePlus aria-hidden size={20} />
                      )}
                    </span>
                  ) : (
                    <LookSwatch look={{ ...draft, background: { ...draft.background, kind } }} period={period} className="h-14 w-full rounded-[9px] ring-1 ring-separator" />
                  )}
                  <span className="px-0.5 text-center text-[13px] font-medium">{copy.backgrounds[kind]}</span>
                </Radio>
              );
            })}
          </div>
          {shownPanel === "gradient" && draft.background.kind === "gradient" && (
            <div role="radiogroup" aria-label={copy.gradientTitle} className="flex gap-2.5 border-t border-separator px-3 py-3">
              {gradients.map((gradient) => (
                <Radio key={gradient} selected={draft.background.gradient === gradient} label={copy.gradients[gradient]} onSelect={() => setBackground({ gradient })} className="flex flex-1 flex-col gap-1 p-1">
                  <LookSwatch look={{ ...draft, background: { ...draft.background, kind: "gradient", gradient } }} period={period} className="h-10 w-full rounded-[8px]" />
                  <span className="text-center text-[12px] font-medium">{copy.gradients[gradient]}</span>
                </Radio>
              ))}
            </div>
          )}
          {shownPanel === "sky" && draft.background.kind === "sky" && (
            <div className="flex flex-col gap-2 border-t border-separator px-4 py-3">
              <p className="text-[13px] leading-snug text-label-secondary">{copy.skyHint}</p>
              <div className="flex flex-wrap gap-2" role="group" aria-label={copy.skyPreview}>
                {periods.map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={period === value}
                    onClick={() => setSkyAt(value)}
                    className="min-h-9 rounded-full bg-fill px-3 text-[13px] font-semibold aria-pressed:bg-accent aria-pressed:text-accent-contrast"
                  >
                    {copy.periods[value]}
                  </button>
                ))}
              </div>
            </div>
          )}
          {shownPanel === "photo" && (
            <div className="border-t border-separator px-4 py-3">
              <PhotoEditor
                photo={draft.background.photo}
                onChange={(photo) => {
                  setPanel("photo");
                  setBackground({ kind: "photo", photo });
                }}
                onRemove={() => {
                  setPanel(null);
                  setBackground({ kind: themeDefaults[draft.theme].background.kind === "photo" ? "plain" : themeDefaults[draft.theme].background.kind, photo: null });
                }}
              />
            </div>
          )}
          {draft.background.kind !== "glow" && draft.background.kind !== "plain" && (
            <div className="flex flex-col gap-2 border-t border-separator px-3 py-3">
              <span className="px-1 text-[15px]">{copy.scopeTitle}</span>
              <SegmentedControl
                label={copy.scopeTitle}
                value={draft.background.scope}
                onChange={(scope) => setBackground({ scope })}
                options={(["today", "main"] as const).map((value) => ({ value, label: copy.scopes[value] }))}
              />
            </div>
          )}
          <p className={hint}>{copy.scopeHint}</p>
        </Card>

        <Card title={copy.cardsTitle}>
          <div role="radiogroup" aria-label={copy.cardsTitle} className="grid grid-cols-3 gap-2.5 p-3">
            {cardStyles.map((cards) => (
              <Radio key={cards} selected={draft.cards === cards} label={copy.cards[cards]} onSelect={() => set({ cards })} className="flex flex-col gap-1.5 p-1">
                <LookSwatch
                  look={{ ...draft, cards, background: { ...draft.background, kind: draft.background.kind === "plain" ? "gradient" : draft.background.kind } }}
                  photoUrl={photoUrl}
                  period={period}
                  className="h-16 w-full rounded-[9px]"
                >
                  <div className="rounded-card bg-surface absolute inset-x-2 bottom-2 top-4 flex flex-col justify-center gap-1 px-2 shadow-card">
                    <span className="h-1 w-8 rounded-full bg-accent" />
                    <span className="h-1 w-12 rounded-full bg-label/15" />
                  </div>
                </LookSwatch>
                <span className="text-center text-[13px] font-medium">{copy.cards[cards]}</span>
              </Radio>
            ))}
          </div>
          {draft.cards === "glass" && !glass && <p className="px-4 pt-1 text-[13px] leading-snug text-label">{copy.glassFallback}</p>}
          <p className={hint}>{copy.cardsHint}</p>
        </Card>

        <Card title={copy.densityTitle}>
          <div className="p-3">
            <SegmentedControl label={copy.densityTitle} value={draft.density} onChange={(density) => set({ density })} options={densities.map((value) => ({ value, label: copy.densities[value] }))} />
          </div>
          <p className={hint}>{copy.densityHint}</p>
        </Card>

        <Card title={copy.fontTitle}>
          <div role="radiogroup" aria-label={copy.fontTitle} className="divide-y divide-separator">
            {fonts.map((font) => {
              const selected = draft.font === font;
              return (
                <button
                  key={font}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => set({ font })}
                  data-font={font}
                  style={{ fontFamily: "var(--app-font)" }}
                  className="flex min-h-14 w-full items-center gap-3 px-4 py-row text-start active:bg-fill"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[17px]">{copy.fonts[font]}</span>
                    <span className="truncate text-[15px] text-label-secondary">{copy.fontSample}</span>
                  </span>
                  {selected && <Check aria-hidden size={18} strokeWidth={2.5} className="shrink-0 text-accent" />}
                </button>
              );
            })}
          </div>
          <p className={hint}>{copy.fontHint}</p>
        </Card>

        <Card title={copy.textTitle}>
          <div className="flex flex-col gap-1 px-4 py-3">
            <span className="flex items-baseline justify-between text-[17px]">
              {copy.textTitle}
              <span className="text-[13px] text-label-secondary">{copy.textSizes[draft.text]}</span>
            </span>
            <TextSizeSlider value={draft.text} onChange={(text) => set({ text })} />
          </div>
          <div className="flex min-h-14 items-center justify-between gap-3 border-t border-separator px-4">
            <span className="text-[17px]">{copy.bold}</span>
            <Switch checked={draft.bold} label={copy.bold} onChange={(bold) => set({ bold })} />
          </div>
          <p className={hint}>{copy.textHint}</p>
        </Card>

        <Card title={copy.motionTitle}>
          <div className="p-3">
            <SegmentedControl label={copy.motionTitle} value={draft.motion} onChange={(motion) => set({ motion })} options={motions.map((value) => ({ value, label: copy.motions[value] }))} />
          </div>
          <p className={hint}>
            {copy.motionHints[draft.motion]}
            {reduceMotion && draft.motion !== "none" ? ` ${copy.motionSystem}` : ""}
          </p>
          <div className="flex min-h-14 items-center justify-between gap-3 border-t border-separator px-4">
            <span className="text-[17px]">{copy.artTitle}</span>
            <Switch checked={draft.art} label={copy.artTitle} onChange={(art) => set({ art })} />
          </div>
          <p className={hint}>{copy.artHint}</p>
        </Card>

        <div className="flex flex-col items-start gap-1 px-1">
          <button
            type="button"
            disabled={sameLook(draft, defaultLook)}
            onClick={() => {
              setNightAsk(false);
              edit(() => defaultLook);
            }}
            className="min-h-11 text-[17px] font-medium text-danger active:opacity-60 disabled:opacity-40"
          >
            {copy.reset}
          </button>
          <p className="text-[13px] leading-snug text-label-secondary">{copy.resetHint}</p>
        </div>

        <AnimatePresence initial={false}>
          {(dirty || status !== "idle") && (
            <motion.div
              key="save-bar"
              initial={{ opacity: 0, transform: "translateY(12px)" }}
              animate={{ opacity: 1, transform: "translateY(0px)", transition: { duration: 0.25, ease: easeOut } }}
              exit={{ opacity: 0, transform: "translateY(8px)", transition: { duration: 0.15, ease: easeOut } }}
              className="sticky bottom-[calc(max(env(safe-area-inset-bottom),10px)+70px)] z-20 md:bottom-6"
            >
              <div className="material flex items-center gap-2 rounded-2xl py-2 pe-2 ps-4 shadow-[0_8px_28px_rgb(30_40_35/0.14)] ring-1 ring-[light-dark(rgb(30_40_35/0.06),rgb(255_255_255/0.09))]">
                <p role="status" className={`min-w-0 flex-1 text-[13px] leading-snug ${status === "failed" || status === "offline" ? "text-danger" : "text-label-secondary"}`}>
                  {message}
                </p>
                {dirty && (
                  <>
                    <button
                      type="button"
                      onClick={cancel}
                      disabled={status === "saving"}
                      className="min-h-11 shrink-0 rounded-full px-4 text-[15px] font-semibold text-accent transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-40"
                    >
                      {copy.cancel}
                    </button>
                    <button
                      type="button"
                      onClick={() => void save()}
                      disabled={status === "saving"}
                      className="min-h-11 shrink-0 rounded-full bg-accent px-5 text-[15px] font-semibold text-accent-contrast transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-40"
                    >
                      {copy.save}
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Sheet open={leaving !== null} onOpenChange={(open) => !open && setLeaving(null)}>
        <SheetBody className="items-stretch pt-2">
          <div className="flex flex-col gap-1 px-1 text-center">
            <Drawer.Title className="text-[20px] font-semibold">{copy.leaveTitle}</Drawer.Title>
            <Drawer.Description className="text-[15px] leading-snug text-label-secondary">{copy.leaveBody}</Drawer.Description>
            {(status === "failed" || status === "offline") && (
              <p role="alert" className="text-[13px] text-danger">
                {status === "offline" ? copy.offline : copy.saveFailed}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={status === "saving"}
              onClick={async () => {
                const href = leaving;
                if (!(await save()) || !href) return;
                setLeaving(null);
                router.push(href);
              }}
              className="min-h-12 rounded-full bg-accent text-[17px] font-semibold text-accent-contrast transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-40"
            >
              {status === "saving" ? copy.saving : copy.leaveSave}
            </button>
            <button
              type="button"
              onClick={() => {
                const href = leaving;
                cancel();
                setLeaving(null);
                if (href) router.push(href);
              }}
              className="min-h-12 rounded-full bg-fill text-[17px] font-semibold text-danger transition-transform duration-150 ease-out active:scale-[0.97]"
            >
              {copy.leaveDiscard}
            </button>
            <button type="button" onClick={() => setLeaving(null)} className="min-h-12 text-[17px] font-semibold text-accent">
              {copy.leaveStay}
            </button>
          </div>
        </SheetBody>
      </Sheet>
    </div>
  );
}
