export type Sky = {
  /** Sun elevation in degrees; negative below the horizon. */
  elevation: number;
  /** Before solar noon. */
  rising: boolean;
  /** Dark enough for stars. */
  starry: boolean;
  /** CSS custom properties for the Today hero scene and the text on top of it. */
  vars: Record<string, string>;
};

/**
 * The hero sky at a moment in time: where the sun and moon are, the colors of the sky and of the light on
 * the house, and an ink color (with a veil when needed) that keeps the greeting legible on top.
 *
 * Must stay self-contained (no imports, no references outside the function body): it is also serialized
 * into the inline script that paints the first frame, before React loads.
 */
export function skyAt(ms: number): Sky {
  const rad = Math.PI / 180;
  const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
  const smooth = (v: number) => {
    const t = clamp(v);
    return t * t * (3 - 2 * t);
  };

  // Location without asking for permission: exact for Israel, otherwise guessed from the time zone.
  const date = new Date(ms);
  const year = date.getFullYear();
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  const jan = new Date(year, 0, 1).getTimezoneOffset();
  const jul = new Date(year, 6, 1).getTimezoneOffset();
  const israel = /^(Asia\/(Jerusalem|Tel_Aviv|Hebron|Gaza)|Israel)$/.test(zone);
  const lat = israel ? 31.8 : jan < jul ? -34 : 40;
  const lon = israel ? 35 : -Math.max(jan, jul) / 4;

  // NOAA solar position (fractional-year approximation).
  const dayOfYear = Math.round((Date.UTC(year, date.getMonth(), date.getDate()) - Date.UTC(year, 0, 1)) / 864e5);
  const minutes = date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
  const g = ((2 * Math.PI) / 365) * (dayOfYear + (minutes / 60 - 12) / 24);
  const eqTime =
    229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl =
    0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const solarMinutes = minutes + eqTime + 4 * lon + date.getTimezoneOffset();
  const rawAngle = (solarMinutes / 4 - 180) * rad;
  const hourAngle = Math.atan2(Math.sin(rawAngle), Math.cos(rawAngle));
  const phi = lat * rad;
  const elevation =
    Math.asin(Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(hourAngle)) / rad;
  const halfDay = Math.acos(
    clamp((Math.sin(-0.833 * rad) - Math.sin(phi) * Math.sin(decl)) / (Math.cos(phi) * Math.cos(decl)), -0.999, 0.999),
  );
  const rising = hourAngle < 0;

  // Both bodies travel the same path, painted for this scene: a round climb from behind the hill on the
  // left, over the roof, then a descent that stays left of the text until it is below it and sets into
  // the valley. Percent of the scene; below the horizon the body sinks out of sight behind the hills.
  const arc = (p: number) => {
    const c = clamp(p);
    const h = Math.sin(Math.PI * c);
    const x = c < 0.5 ? 36 - 35 * Math.sqrt(1 - h * h) : 36 + 21 * (1 - h ** 1.05) ** (1 / 1.05);
    return [x, 84 - 71 * h + Math.max(0, -p, p - 1) * 140];
  };
  const dayProgress = (hourAngle + halfDay) / (2 * halfDay);
  const night = 2 * Math.PI - 2 * halfDay;
  const nightProgress =
    hourAngle > halfDay ? (hourAngle - halfDay) / night : hourAngle < -halfDay ? (hourAngle + 2 * Math.PI - halfDay) / night : -1;
  const [sunX, sunY] = arc(dayProgress);
  const [moonX, moonY] = arc(nightProgress);

  // Light keyed to the sun's elevation; dawn and dusk get their own palettes.
  // [elevation, sky top, sky middle, horizon, glow, glow alpha, light on the house, clouds, sun, window glow]
  type Frame = [number, string, string, string, string, number, string, string, string, number];
  const dawn: Frame[] = [
    [-18, "#060a1f", "#0c1538", "#1a2654", "#7888dc", 0, "#3e4b8a", "#36406f", "#ffb46b", 1],
    [-10, "#0d1640", "#23306a", "#4a4f8c", "#a070a0", 0.12, "#4b5594", "#474b80", "#ffb46b", 1],
    [-5, "#26336f", "#5d64a3", "#c58fa8", "#dc96aa", 0.3, "#7578ad", "#9a8bba", "#ffb46b", 0.9],
    [-1.5, "#4c63a9", "#a59bcc", "#ffbfa0", "#ffb996", 0.55, "#b6a7c8", "#e6c5d2", "#ffb46b", 0.7],
    [1.5, "#7d9ad3", "#e2c3d4", "#ffd2a8", "#ffcd9b", 0.7, "#ecd3c9", "#ffdcd2", "#ffb46b", 0.4],
    [6, "#78aee3", "#cfdcee", "#ffe8c8", "#ffe8b9", 0.5, "#fcebdc", "#fff1e4", "#fff0c8", 0.1],
    [15, "#6db2ec", "#a9d5f4", "#e5f3f5", "#fff8dc", 0.4, "#ffffff", "#ffffff", "#fffaf0", 0],
    [35, "#69aeea", "#a6d3f3", "#dceef8", "#fffaeb", 0.35, "#ffffff", "#ffffff", "#ffffff", 0],
  ];
  const dusk: Frame[] = [
    [-18, "#060a1f", "#0c1538", "#1a2654", "#7888dc", 0, "#3e4b8a", "#36406f", "#ff8c3a", 1],
    [-10, "#0e1440", "#241f55", "#4a3064", "#a05a82", 0.12, "#4f5292", "#3e3a6a", "#ff8c3a", 1],
    [-5, "#262a6c", "#5e3f80", "#b85a6a", "#c85a64", 0.3, "#7a6aa5", "#8a6795", "#ff8c3a", 0.9],
    [-1.5, "#4a4f9a", "#b06a95", "#f0805a", "#f06e50", 0.55, "#b58aa8", "#d0899c", "#ff8c3a", 0.7],
    [1.5, "#8b8fcf", "#eea7a6", "#ff9a52", "#ff8c46", 0.8, "#f6b796", "#ffb898", "#ff8c3a", 0.4],
    [6, "#77a3d9", "#d2c6d6", "#ffd59c", "#ffcd8c", 0.55, "#ffe0c2", "#ffe6cf", "#ffd27e", 0.1],
    [15, "#6aaae7", "#acd1ef", "#f1efe4", "#fff0cd", 0.4, "#fffaf2", "#fffaf3", "#fff6dc", 0],
    [35, "#69aeea", "#a6d3f3", "#dceef8", "#fffaeb", 0.35, "#ffffff", "#ffffff", "#ffffff", 0],
  ];

  const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const toGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
  const parse = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return [n >> 16, (n >> 8) & 255, n & 255];
  };
  const toLab = (hex: string) => {
    const [r, gr, b] = parse(hex).map((c) => toLinear(c / 255));
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * gr + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * gr + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * gr + 0.6299787005 * b);
    return [
      0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    ];
  };
  const fromLab = ([L, a, b]: number[]) => {
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    return [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ].map((c) => Math.round(255 * clamp(toGamma(clamp(c)))));
  };

  const frames = rising ? dawn : dusk;
  let i = 0;
  while (i < frames.length - 2 && elevation > frames[i + 1][0]) i++;
  const [from, to] = [frames[i], frames[i + 1]];
  const t = clamp((elevation - from[0]) / (to[0] - from[0]));
  const color = (k: number) => {
    const a = toLab(from[k] as string);
    const b = toLab(to[k] as string);
    return fromLab(a.map((v, j) => v + (b[j] - v) * t));
  };
  const num = (k: number) => (from[k] as number) + ((to[k] as number) - (from[k] as number)) * t;
  const hex = (c: number[]) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");

  const top = color(1), mid = color(2), horizon = color(3), glow = color(4);
  const glowAlpha = num(5);

  // Ink: dark navy or white, whichever needs the lighter veil to keep every text row at WCAG AA
  // (the name is large text, 3:1). Rows sample the sky gradient (stops 0/58/86%) where the text sits.
  const luminance = (c: number[]) =>
    0.2126 * toLinear(c[0] / 255) + 0.7152 * toLinear(c[1] / 255) + 0.0722 * toLinear(c[2] / 255);
  const mix = (a: number[], b: number[], k: number) => a.map((v, j) => v + (b[j] - v) * k);
  const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  const rows: [number[], number, number][] = [
    [mix(mix(top, mid, 0.21), glow, glowAlpha * 0.15), 4.5, 0],
    [mix(mix(top, mid, 0.52), glow, glowAlpha * 0.2), 3, 0],
    [mix(mix(top, mid, 0.83), glow, glowAlpha * 0.35), 4.5, 1],
    [mix(mix(mid, horizon, 0.07), glow, glowAlpha * 0.45), 4.5, 1],
  ];
  // Dark mode dims the daylight sky so the card doesn't glare (.sky-dim); the veil holds on both skies.
  const dim = 0.14 * smooth((elevation + 4) / 10);
  const navy = [15, 42, 68], white = [255, 255, 255], indigo = [20, 16, 48];
  const veil = (ink: number[], wash: number[]) => {
    const need = [0, 0];
    for (const shade of [1, 1 - dim]) {
      for (const [row, ratio, region] of rows) {
        const lit = row.map((v) => v * shade);
        let a = 0;
        while (a < 0.6 && contrast(luminance(mix(lit, wash, a)), luminance(ink)) < ratio) a += 0.02;
        need[region] = Math.max(need[region], a);
      }
    }
    return need;
  };
  const darkVeil = veil(navy, white);
  const lightVeil = veil(white, indigo);
  const dark = Math.max(...darkVeil) <= Math.max(...lightVeil);
  const [veilTop, veilLow] = dark ? darkVeil : lightVeil;
  const wash = dark ? "255 255 255" : "20 16 48";

  const low = clamp(1 - elevation / 18);
  const windows = num(9);
  const pct = (v: number) => v.toFixed(2) + "%";

  return {
    elevation,
    rising,
    starry: elevation < -4,
    vars: {
      "--sky-top": hex(top),
      "--sky-mid": hex(mid),
      "--sky-horizon": hex(horizon),
      "--sky-glow": glow.join(" "),
      "--sky-glow-a": glowAlpha.toFixed(3),
      "--sky-glow-x": pct(sunX),
      "--sky-glow-y": pct(Math.min(sunY, 84)),
      "--sky-glow-w": pct(30 + 40 * low),
      "--sky-glow-h": pct(28 + 32 * low),
      "--sky-sun": hex(color(8)),
      "--sky-sun-x": pct(sunX),
      "--sky-sun-y": pct(sunY),
      "--sky-sun-a": clamp((elevation + 2.5) / 3).toFixed(3),
      "--sky-sun-scale": (1 + 0.3 * smooth(1 - elevation / 8)).toFixed(3),
      "--sky-moon-x": pct(moonX),
      "--sky-moon-y": pct(moonY),
      "--sky-moon-a": clamp((3 - elevation) / 8).toFixed(3),
      "--sky-stars": smooth((-elevation - 4) / 8).toFixed(3),
      "--sky-house": hex(color(6)),
      "--sky-cloud": hex(color(7)),
      "--sky-windows": windows.toFixed(3),
      "--sky-smoke": (0.15 + 0.45 * windows).toFixed(3),
      "--sky-dim": dim.toFixed(3),
      "--scene-ink": dark ? "#0f2a44" : "#ffffff",
      "--scene-glass": dark ? "rgb(255 255 255 / 0.45)" : "rgb(255 255 255 / 0.16)",
      "--scene-text-shadow": dark ? "none" : "0 1px 2px rgb(0 0 0 / 0.3)",
      "--scene-veil-top": `rgb(${wash} / ${veilTop.toFixed(2)})`,
      "--scene-veil-low": `rgb(${wash} / ${veilLow.toFixed(2)})`,
    },
  };
}

/** Writes the sky onto <html>, where the hero scene and the greeting over it read it. */
export function paintSky(sky: Sky) {
  const root = document.documentElement;
  for (const key in sky.vars) root.style.setProperty(key, sky.vars[key]);
  root.toggleAttribute("data-starry", sky.starry);
}

/** Paints the sky for the current moment before first paint, so the hero never flashes the wrong time of day. */
export const skyScript = `try{var n=Date.now(),s=(${skyAt.toString()})(n),d=document.documentElement;for(var k in s.vars)d.style.setProperty(k,s.vars[k]);d.toggleAttribute("data-starry",s.starry);d.style.setProperty("--sky-now",Math.round(n/1e3%86400))}catch(e){}`;
