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

  // Light keyed to the sun's elevation; dawn and dusk get their own palettes. The house is painted in
  // neutral daylight: "ambient" tints all of it, "sun" the side facing the sun (the moon at night).
  // [elevation, sky top, sky middle, horizon, glow, glow alpha, ambient, sun on the house, land, cloud lit,
  //  cloud shade, sun disc, window glow]
  type Frame = [number, string, string, string, string, number, string, string, string, string, string, string, number];
  const nightFrame: Frame = [-18, "#070b1c", "#0c1430", "#172245", "#6a7ad0", 0, "#3a4362", "#5d6a99", "#060915", "#2c3458", "#141a36", "#ffc890", 1];
  const noonFrame: Frame = [35, "#5f96cc", "#9dc0e2", "#d8e5ee", "#fffaf0", 0.22, "#f6f5f2", "#ffffff", "#6e7e7e", "#ffffff", "#e2e9f0", "#ffffff", 0];
  const dawn: Frame[] = [
    nightFrame,
    [-11, "#0a1230", "#18234d", "#2e3866", "#8a6aa0", 0.08, "#434b6e", "#66709f", "#0c1127", "#3c4270", "#1e2446", "#ffc890", 1],
    [-6, "#1b2652", "#3f4a7e", "#7d7298", "#c890a0", 0.22, "#5a6087", "#7a7fac", "#1f2342", "#7a7aa4", "#3c4068", "#ffc890", 0.95],
    [-2, "#3a4f86", "#8b8fb4", "#d9a9a2", "#f2b494", 0.42, "#8a87a6", "#c9a9b4", "#4b4a68", "#e2b6b0", "#8d88aa", "#ffc890", 0.7],
    [1.5, "#5f7fb4", "#b9b4c6", "#f0c49c", "#ffcf9e", 0.55, "#c4b2b2", "#ffd2a6", "#6b6476", "#ffd9b8", "#b8a8bc", "#ffd6a0", 0.3],
    [6, "#6d97c8", "#b6c8dc", "#ecdcc6", "#ffe6bf", 0.38, "#e2d8d0", "#fff0dc", "#717a7e", "#fff6ea", "#d8d8e2", "#fff4e0", 0.05],
    [15, "#6a9cd0", "#a6c4e0", "#dde6ec", "#fff6e0", 0.28, "#f0ede8", "#fffaf2", "#6f7d7c", "#ffffff", "#e0e6ee", "#fffaf0", 0],
    noonFrame,
  ];
  const dusk: Frame[] = [
    nightFrame,
    [-11, "#111a42", "#23295a", "#3d3a66", "#8c5a80", 0.08, "#453f6a", "#6a6698", "#0e1128", "#433f6c", "#20203f", "#ff9a50", 1],
    [-5, "#222c62", "#4e4c80", "#9a6a7c", "#b8607a", 0.22, "#5e5a84", "#86789e", "#262341", "#a6708c", "#4a4670", "#ff9a50", 0.95],
    [-1.5, "#3e4a86", "#9a7894", "#e08a68", "#ec8058", 0.42, "#8e7f9a", "#d8a0a0", "#4d4256", "#f0a08a", "#6e6488", "#ff9a50", 0.7],
    [1.5, "#59689e", "#c89a94", "#eca06c", "#ff9a5a", 0.62, "#bba3a2", "#ffc68e", "#5d4f5a", "#ffbe8a", "#a2899c", "#ff9a50", 0.35],
    [6, "#6a8cbf", "#c3c0c4", "#efd2a8", "#ffcf8e", 0.45, "#e2d4c6", "#ffe2b8", "#6e6662", "#fff0d8", "#d6d0d4", "#ffd58a", 0.05],
    [15, "#6496ca", "#a8c2dc", "#e6e2d8", "#fff0d0", 0.3, "#f0ece6", "#fff8ee", "#6e7a78", "#fffaf2", "#dde2ea", "#fff6e0", 0],
    noonFrame,
  ];

  const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const toGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
  const parse = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return [n >> 16, (n >> 8) & 255, n & 255];
  };
  const toLab = (rgb: number[]) => {
    const [r, gr, b] = rgb.map((c) => toLinear(c / 255));
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
  const blend = (a: number[], b: number[], k: number) => {
    const la = toLab(a), lb = toLab(b);
    return fromLab(la.map((v, j) => v + (lb[j] - v) * k));
  };
  const color = (k: number) => blend(parse(from[k] as string), parse(to[k] as string), t);
  const num = (k: number) => (from[k] as number) + ((to[k] as number) - (from[k] as number)) * t;
  const hex = (c: number[]) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");

  const top = color(1), mid = color(2), horizon = color(3), glow = color(4);
  const glowAlpha = num(5);

  // Atmospheric perspective: the farther the ridge, the more of the horizon's color it takes, and each
  // ridge lightens toward its foot where haze collects in the valley.
  const land = color(8);
  const ridges = [0.3, 0.55, 0.8].map((depth) => {
    const crest = blend(horizon, land, depth);
    return [crest, blend(crest, horizon, 0.35)];
  });

  // Low sun lights the side of the house that faces it: the gable end in the morning (the sun rises on
  // the left), the long side in the evening. At night the moon does the same, faintly.
  const sunSide = clamp((elevation + 1) / 3) * (1 - smooth((elevation - 6) / 26));
  const moonSide = nightProgress >= 0 ? 0.55 * Math.sin(Math.PI * nightProgress) * smooth((-elevation - 4) / 6) : 0;
  const east = (rising ? sunSide : 0) + (nightProgress >= 0 && nightProgress < 0.5 ? moonSide : 0);
  const west = (rising ? 0 : sunSide) + (nightProgress >= 0.5 ? moonSide : 0);

  // Ink: dark navy or white, whichever needs the lighter veil to keep every text row at WCAG AA, with a 4%
  // margin for what this doesn't model (clouds, antialiasing). The name is large text, 3:1. Rows sample the sky gradient (stops 0/58/86%) at the top edge of each
  // line (greeting, name, summary, and a summary pushed down by a two-line name), plus as much of the sun's
  // glow as reaches the text column (x 85%). The veil fades out toward the house, so the lower lines,
  // which run longer, only get 80% of it at their far end.
  const luminance = (c: number[]) =>
    0.2126 * toLinear(c[0] / 255) + 0.7152 * toLinear(c[1] / 255) + 0.0722 * toLinear(c[2] / 255);
  const mix = (a: number[], b: number[], k: number) => a.map((v, j) => v + (b[j] - v) * k);
  const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  const low = clamp(1 - elevation / 18);
  const glowAt = (y: number) => {
    const d = Math.hypot((85 - sunX) / (30 + 40 * low), (y - Math.min(sunY, 84)) / (28 + 32 * low));
    return glowAlpha * (d < 0.45 ? 1 - (0.6 * d) / 0.45 : Math.max(0, 0.4 * (1 - (d - 0.45) / 0.55)));
  };
  const rows: [number[], number, number][] = [
    [mix(mix(top, mid, 0.14), glow, glowAt(8)), 4.5, 0],
    [mix(mix(top, mid, 0.29), glow, glowAt(17)), 3, 0],
    [mix(mix(top, mid, 0.72), glow, glowAt(42)), 4.5, 1],
    [mix(mix(mid, horizon, 0.07), glow, glowAt(60)), 4.5, 1],
  ];
  // Dark mode dims the daylight sky so the card doesn't glare (.sky-dim); the veil holds on both skies.
  const dim = 0.14 * smooth((elevation + 4) / 10);
  const navy = [15, 42, 68], white = [255, 255, 255], indigo = [20, 16, 48];
  const veil = (ink: number[], wash: number[]) => {
    const need = [0, 0];
    for (const shade of [1, 1 - dim]) {
      for (const [row, ratio, region] of rows) {
        const lit = row.map((v) => v * shade);
        const reach = region ? 0.8 : 1;
        let a = 0;
        while (a < 0.6 && contrast(luminance(mix(lit, wash, a * reach)), luminance(ink)) < ratio * 1.04) a += 0.02;
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
      "--sky-sun": hex(color(11)),
      "--sky-sun-x": pct(sunX),
      "--sky-sun-y": pct(sunY),
      "--sky-sun-a": clamp((elevation + 2.5) / 3).toFixed(3),
      "--sky-sun-scale": (1 + 0.3 * smooth(1 - elevation / 8)).toFixed(3),
      "--sky-moon-x": pct(moonX),
      "--sky-moon-y": pct(moonY),
      "--sky-moon-a": clamp((3 - elevation) / 8).toFixed(3),
      "--sky-stars": smooth((-elevation - 4) / 8).toFixed(3),
      "--sky-windows": num(12).toFixed(3),
      "--sky-dim": dim.toFixed(3),
      "--cloud-lit": hex(color(9)),
      "--cloud-shade": hex(color(10)),
      "--land-1": hex(ridges[0][0]),
      "--land-1-foot": hex(ridges[0][1]),
      "--land-2": hex(ridges[1][0]),
      "--land-2-foot": hex(ridges[1][1]),
      "--land-3": hex(ridges[2][0]),
      "--land-3-foot": hex(ridges[2][1]),
      "--home-ambient": hex(color(6)),
      "--home-sun": hex(color(7)),
      "--home-east": east.toFixed(3),
      "--home-west": west.toFixed(3),
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
