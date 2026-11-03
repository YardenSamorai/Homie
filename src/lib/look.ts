import { inkOn, mix, normalizeHex, readableOn } from "./color";

/**
 * How Homie looks for one parent: a theme (the palette), light or dark, an accent, a background, cards, density,
 * type and motion. Saved in the profile (src/lib/prefs.ts), so it follows the person to every device and never
 * changes what the other parent sees. Only these fields and values exist; nothing here is free CSS.
 */

export const lookThemes = ["nature", "clean", "warm", "night"] as const;
export type LookTheme = (typeof lookThemes)[number];

export const modes = ["light", "dark", "system"] as const;
export type Mode = (typeof modes)[number];

export const accentPresets = ["sage", "coral", "teal", "indigo", "plum"] as const;
export type AccentPreset = (typeof accentPresets)[number];
export type Accent = { kind: "theme" } | { kind: "preset"; id: AccentPreset } | { kind: "custom"; hex: string };

export const backgroundKinds = ["glow", "plain", "tint", "gradient", "sky", "photo"] as const;
export type BackgroundKind = (typeof backgroundKinds)[number];
export const gradients = ["dawn", "sea", "meadow", "dusk"] as const;
export type Gradient = (typeof gradients)[number];
export const backgroundScopes = ["today", "main"] as const;
export type BackgroundScope = (typeof backgroundScopes)[number];

/** Where the photo sits: its focus point (0–100 across and down), how far it's zoomed, blurred and veiled. */
export type Photo = { path: string; x: number; y: number; zoom: number; blur: number; veil: number };
export type Background = { kind: BackgroundKind; gradient: Gradient; scope: BackgroundScope; photo: Photo | null };

export const cardStyles = ["solid", "glass", "outline"] as const;
export type CardStyle = (typeof cardStyles)[number];
export const densities = ["roomy", "regular", "compact"] as const;
export type Density = (typeof densities)[number];
export const fonts = ["system", "heebo", "rubik", "assistant", "frank"] as const;
export type Font = (typeof fonts)[number];
export const textSizes = ["0", "1", "2", "3", "4", "5"] as const;
export type TextSize = (typeof textSizes)[number];
export const motions = ["full", "gentle", "none"] as const;
export type MotionLevel = (typeof motions)[number];

export type Look = {
  theme: LookTheme;
  mode: Mode;
  accent: Accent;
  background: Background;
  cards: CardStyle;
  density: Density;
  font: Font;
  text: TextSize;
  bold: boolean;
  motion: MotionLevel;
  /** The large decorative drawings at the head of a list and the front-door opening. */
  art: boolean;
};

export const textScale: Record<TextSize, number> = { "0": 0.9, "1": 0.95, "2": 1, "3": 1.08, "4": 1.15, "5": 1.25 };

export const PHOTO_LIMITS = { zoom: [1, 2.5], blur: [0, 24], veil: [45, 90] } as const;

/** What choosing a theme sets. Everything else (mode, type, size, motion, density) stays the parent's own. */
export const themeDefaults: Record<LookTheme, { accent: Accent; background: Pick<Background, "kind" | "gradient">; cards: CardStyle }> = {
  nature: { accent: { kind: "theme" }, background: { kind: "glow", gradient: "meadow" }, cards: "solid" },
  clean: { accent: { kind: "theme" }, background: { kind: "plain", gradient: "sea" }, cards: "outline" },
  warm: { accent: { kind: "theme" }, background: { kind: "gradient", gradient: "dawn" }, cards: "solid" },
  night: { accent: { kind: "theme" }, background: { kind: "plain", gradient: "dusk" }, cards: "solid" },
};

export const defaultLook: Look = {
  theme: "nature",
  mode: "light",
  accent: { kind: "theme" },
  background: { kind: "glow", gradient: "meadow", scope: "today", photo: null },
  cards: "solid",
  density: "regular",
  font: "system",
  text: "2",
  bold: false,
  motion: "full",
  art: true,
};

/** The page and card colors of each theme, light and dark. Mirrors the [data-look] blocks in globals.css. */
export const palettes: Record<LookTheme, { light: { bg: string; surface: string; label: string }; dark: { bg: string; surface: string; label: string } }> = {
  nature: { light: { bg: "#f8f7f2", surface: "#ffffff", label: "#1f2d28" }, dark: { bg: "#121614", surface: "#1c2420", label: "#f3f6f4" } },
  clean: { light: { bg: "#f5f5f4", surface: "#ffffff", label: "#1c1c1e" }, dark: { bg: "#141414", surface: "#1e1e1f", label: "#f2f2f3" } },
  warm: { light: { bg: "#faf5ef", surface: "#fffdfa", label: "#2d221c" }, dark: { bg: "#17120f", surface: "#221b17", label: "#f6efe9" } },
  night: { light: { bg: "#eef0f5", surface: "#ffffff", label: "#1b2033" }, dark: { bg: "#0f1320", surface: "#181d2c", label: "#e8ebf3" } },
};

type Pair = [light: string, dark: string];
type AccentSet = { accent: Pair; ink: Pair; fill: Pair; soft: Pair };

/** Hand-tuned accents: the five Settings has always offered, and each theme's own. */
const tuned: Record<AccentPreset | `theme-${LookTheme}`, AccentSet> = {
  sage: { accent: ["#527a67", "#8fbfab"], ink: ["#ffffff", "#10211a"], fill: ["#e5efe7", "rgb(143 191 171 / 0.18)"], soft: ["#e5efe7", "#24302b"] },
  coral: { accent: ["#a35d42", "#e0a48c"], ink: ["#ffffff", "#2a140e"], fill: ["#f6e4da", "rgb(163 93 66 / 0.22)"], soft: ["#f6e4da", "#3a2822"] },
  teal: { accent: ["#3d7480", "#8eb8c2"], ink: ["#ffffff", "#0e1c20"], fill: ["#e3f0f2", "rgb(61 116 128 / 0.24)"], soft: ["#e3f0f2", "#1c2c30"] },
  indigo: { accent: ["#5a5f94", "#a4a8d4"], ink: ["#ffffff", "#16182c"], fill: ["#e8e9f4", "rgb(90 95 148 / 0.24)"], soft: ["#e8e9f4", "#262838"] },
  plum: { accent: ["#6e5c88", "#b4a4c8"], ink: ["#ffffff", "#1c1424"], fill: ["#f0eaf4", "rgb(110 92 136 / 0.24)"], soft: ["#f0eaf4", "#2c2434"] },
  "theme-nature": { accent: ["#527a67", "#8fbfab"], ink: ["#ffffff", "#10211a"], fill: ["#e5efe7", "rgb(143 191 171 / 0.18)"], soft: ["#e5efe7", "#24302b"] },
  "theme-clean": { accent: ["#3d5a80", "#8fb0d9"], ink: ["#ffffff", "#0f1a2a"], fill: ["#e6ebf2", "rgb(143 176 217 / 0.18)"], soft: ["#e6ebf2", "#1f2633"] },
  "theme-warm": { accent: ["#a35d42", "#e0a48c"], ink: ["#ffffff", "#2a140e"], fill: ["#f6e4da", "rgb(224 164 140 / 0.2)"], soft: ["#f6e4da", "#33241d"] },
  "theme-night": { accent: ["#5a5f94", "#a4a8d4"], ink: ["#ffffff", "#141828"], fill: ["#e4e6f2", "rgb(164 168 212 / 0.18)"], soft: ["#e4e6f2", "#232a40"] },
};

/** The accent pair the parent sees, already made readable for this theme's backgrounds in both modes. */
export function accentSet(look: Pick<Look, "theme" | "accent">): AccentSet & { adjusted: boolean } {
  if (look.accent.kind === "preset") return { ...tuned[look.accent.id], adjusted: false };
  if (look.accent.kind === "theme") return { ...tuned[`theme-${look.theme}`], adjusted: false };
  const raw = normalizeHex(look.accent.hex) ?? "#527a67";
  const { light, dark } = palettes[look.theme];
  const lightAccent = readableOn(raw, [light.bg, light.surface]);
  const darkAccent = readableOn(raw, [dark.bg, dark.surface]);
  return {
    accent: [lightAccent, darkAccent],
    ink: [inkOn(lightAccent, light.label), inkOn(darkAccent, dark.bg)],
    fill: [mix(light.bg, lightAccent, 0.13), mix(dark.surface, darkAccent, 0.2)],
    soft: [mix(light.bg, lightAccent, 0.12), mix(dark.bg, darkAccent, 0.16)],
    adjusted: lightAccent !== raw || darkAccent !== raw,
  };
}

/** Changed anything a theme sets since choosing it: the picker says "customized". */
export function isCustomized(look: Look) {
  const base = themeDefaults[look.theme];
  return look.accent.kind !== "theme" || look.background.kind !== base.background.kind || (look.background.kind === "gradient" && look.background.gradient !== base.background.gradient) || look.cards !== base.cards;
}

/** A theme replaces the palette, accent, background and cards. Type size, bold, motion, density and the home layout stay. */
export function withTheme(look: Look, theme: LookTheme): Look {
  const base = themeDefaults[theme];
  return {
    ...look,
    theme,
    accent: base.accent,
    background: { ...look.background, kind: base.background.kind, gradient: base.background.gradient },
    cards: base.cards,
  };
}

const pick = <T extends string>(list: readonly T[], value: unknown, fallback: T): T => (list.includes(value as T) ? (value as T) : fallback);
const clamp = (value: unknown, [low, high]: readonly [number, number], fallback: number) => {
  const n = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(high, Math.max(low, n));
};
const PHOTO_PATH = /^backgrounds\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(webp|jpg)$/;

function readAccent(raw: unknown): Accent {
  const value = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  if (value.kind === "preset") return { kind: "preset", id: pick(accentPresets, value.id, "sage") };
  if (value.kind === "custom" && typeof value.hex === "string") {
    const hex = normalizeHex(value.hex);
    if (hex) return { kind: "custom", hex };
  }
  return { kind: "theme" };
}

function readPhoto(raw: unknown): Photo | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.path !== "string" || !PHOTO_PATH.test(value.path)) return null;
  return {
    path: value.path,
    x: Math.round(clamp(value.x, [0, 100], 50)),
    y: Math.round(clamp(value.y, [0, 100], 50)),
    zoom: Math.round(clamp(value.zoom, PHOTO_LIMITS.zoom, 1) * 100) / 100,
    blur: Math.round(clamp(value.blur, PHOTO_LIMITS.blur, 0)),
    veil: Math.round(clamp(value.veil, PHOTO_LIMITS.veil, 60)),
  };
}

/** Whatever was stored, as a look that can be drawn: unknown fields dropped, bad values back to their default. */
export function readLook(raw: unknown): Look {
  const value = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const theme = pick(lookThemes, value.theme, defaultLook.theme);
  const bg = (value.background && typeof value.background === "object" ? value.background : {}) as Record<string, unknown>;
  const photo = readPhoto(bg.photo);
  let kind = pick(backgroundKinds, bg.kind, themeDefaults[theme].background.kind);
  if (kind === "photo" && !photo) kind = themeDefaults[theme].background.kind;
  return {
    theme,
    mode: pick(modes, value.mode, defaultLook.mode),
    accent: readAccent(value.accent),
    background: {
      kind,
      gradient: pick(gradients, bg.gradient, themeDefaults[theme].background.gradient),
      scope: pick(backgroundScopes, bg.scope, defaultLook.background.scope),
      photo,
    },
    cards: pick(cardStyles, value.cards, themeDefaults[theme].cards),
    density: pick(densities, value.density, defaultLook.density),
    font: pick(fonts, value.font, defaultLook.font),
    text: pick(textSizes, value.text, defaultLook.text),
    bold: typeof value.bold === "boolean" ? value.bold : defaultLook.bold,
    motion: pick(motions, value.motion, defaultLook.motion),
    art: typeof value.art === "boolean" ? value.art : defaultLook.art,
  };
}

/** The first look of someone who chose things on this device before looks were saved in the account. */
export function lookFromDevice(device: { theme?: string | null; text?: string | null; tint?: string | null; bold?: string | null }): Look {
  return readLook({
    ...defaultLook,
    mode: device.theme,
    text: device.text,
    bold: device.bold === "1",
    accent: device.tint && device.tint !== "sage" && accentPresets.includes(device.tint as AccentPreset) ? { kind: "preset", id: device.tint } : { kind: "theme" },
  });
}

export type LookTokens = {
  /** data-* attributes for the element the look applies to (the page root, or a preview). */
  attrs: Record<string, string>;
  /** CSS custom properties, already resolved for light and dark with light-dark(). */
  vars: Record<string, string>;
  zoom: number;
};

const pair = ([light, dark]: Pair) => `light-dark(${light}, ${dark})`;

export function lookTokens(look: Look): LookTokens {
  const set = accentSet(look);
  const { kind, gradient, scope, photo } = look.background;
  return {
    attrs: {
      theme: look.mode,
      look: look.theme,
      bg: kind,
      gradient,
      "bg-scope": scope,
      cards: look.cards,
      density: look.density,
      font: look.font,
      text: look.text,
      bold: look.bold ? "1" : "0",
      motion: look.motion,
      art: look.art ? "1" : "0",
    },
    vars: {
      "--accent": pair(set.accent),
      "--accent-contrast": pair(set.ink),
      "--today": pair(set.accent),
      "--today-contrast": pair(set.ink),
      "--fill": pair(set.fill),
      "--sage-light": pair(set.soft),
      ...(photo && kind === "photo"
        ? { "--bg-x": `${photo.x}%`, "--bg-y": `${photo.y}%`, "--bg-zoom": String(photo.zoom), "--bg-blur": `${photo.blur}px`, "--bg-veil": `${photo.veil}%` }
        : {}),
    },
    zoom: textScale[look.text],
  };
}

/** The status bar and the native shell's background: the theme's page color in the mode on screen. */
export function pageColor(look: Pick<Look, "theme">, dark: boolean) {
  return palettes[look.theme][dark ? "dark" : "light"].bg;
}