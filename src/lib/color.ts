/**
 * Color math for a parent's own accent: sRGB ↔ OKLab, WCAG contrast, and moving a color's lightness (keeping its hue)
 * until text in it, and text on it, stays readable. No dependencies; runs the same on the server and in the browser.
 */

export type Rgb = { r: number; g: number; b: number };
type Lab = { L: number; a: number; b: number };

const HEX = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i;

export function parseHex(value: string): Rgb | null {
  const match = HEX.exec(value.trim());
  if (!match) return null;
  let hex = match[1].toLowerCase();
  if (hex.length === 3) hex = hex.replace(/./g, (c) => c + c);
  const n = Number.parseInt(hex, 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

/** "#5a5f94" from any accepted spelling ("5A5F94", "#abc"), or null. */
export function normalizeHex(value: string): string | null {
  const rgb = parseHex(value);
  return rgb ? toHex(rgb) : null;
}

export function toHex({ r, g, b }: Rgb) {
  const part = (v: number) =>
    Math.round(Math.min(1, Math.max(0, v)) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`;
}

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function toLab({ r, g, b }: Rgb): Lab {
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

/** Linear sRGB, unclamped: a value outside 0–1 means the color is out of gamut. */
function labToLinear({ L, a, b }: Lab) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return {
    r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  };
}

const inGamut = ({ r, g, b }: Rgb) => [r, g, b].every((v) => v >= -0.0001 && v <= 1.0001);

/** OKLCH lightness and hue kept, chroma reduced until the color exists on screen. */
function fromLch(L: number, C: number, h: number): Rgb {
  let low = 0;
  let high = C;
  let best = labToLinear({ L, a: 0, b: 0 });
  for (let i = 0; i < 18; i++) {
    const mid = i === 0 ? C : (low + high) / 2;
    const linear = labToLinear({ L, a: mid * Math.cos(h), b: mid * Math.sin(h) });
    if (inGamut(linear)) {
      best = linear;
      if (i === 0) break;
      low = mid;
    } else {
      high = mid;
    }
  }
  return { r: toGamma(Math.max(0, best.r)), g: toGamma(Math.max(0, best.g)), b: toGamma(Math.max(0, best.b)) };
}

function toLch(rgb: Rgb) {
  const { L, a, b } = toLab(rgb);
  return { L, C: Math.hypot(a, b), h: Math.atan2(b, a) };
}

export function luminance(rgb: Rgb) {
  return 0.2126 * toLinear(rgb.r) + 0.7152 * toLinear(rgb.g) + 0.0722 * toLinear(rgb.b);
}

export function contrast(one: string | Rgb, two: string | Rgb) {
  const a = typeof one === "string" ? parseHex(one) : one;
  const b = typeof two === "string" ? parseHex(two) : two;
  if (!a || !b) return 1;
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Mixes in OKLab, like CSS color-mix(in oklab, …): `amount` of `over` on top of `base`. */
export function mix(base: string, over: string, amount: number) {
  const a = parseHex(base);
  const b = parseHex(over);
  if (!a || !b) return base;
  const x = toLab(a);
  const y = toLab(b);
  const t = Math.min(1, Math.max(0, amount));
  const linear = labToLinear({ L: x.L + (y.L - x.L) * t, a: x.a + (y.a - x.a) * t, b: x.b + (y.b - x.b) * t });
  return toHex({ r: toGamma(Math.max(0, linear.r)), g: toGamma(Math.max(0, linear.g)), b: toGamma(Math.max(0, linear.b)) });
}

/**
 * The same hue made dark enough (on light backgrounds) or light enough (on dark ones) to read as text against
 * every one of `backgrounds` at `target` contrast. A color that already passes comes back unchanged.
 */
export function readableOn(hex: string, backgrounds: string[], target = 4.5) {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const passes = (color: Rgb) => backgrounds.every((bg) => contrast(color, bg) >= target);
  if (passes(rgb)) return toHex(rgb);
  const lighter = backgrounds.every((bg) => luminance(parseHex(bg) ?? rgb) < 0.2);
  const { L, C, h } = toLch(rgb);
  for (let step = 1; step <= 100; step++) {
    const next = lighter ? Math.min(1, L + step * 0.01) : Math.max(0, L - step * 0.01);
    const color = fromLch(next, C, h);
    if (passes(color)) return toHex(color);
  }
  return lighter ? "#ffffff" : "#000000";
}

/** White or the given dark ink, whichever reads better on `fill`. */
export function inkOn(fill: string, dark: string) {
  return contrast("#ffffff", fill) >= contrast(dark, fill) ? "#ffffff" : dark;
}
