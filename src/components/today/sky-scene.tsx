"use client";

import {
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type Ref,
} from "react";
import { paintSky, skyAt } from "@/lib/sky";
import { SkyFlyers, type SkyFlyersHandle } from "./sky-flyers";

export type SkySceneHandle = { summon: () => void };

// Followed live, unlike motion's useReducedMotion, which reads the setting once on mount.
const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const media = window.matchMedia(reducedMotionQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

// Seeded, so the server and the browser draw the same stars, and rounded, because the browser keeps
// only a few digits of inline styles and hydration would see a mismatch. Fewer and dimmer over the text.
const stars = (() => {
  let seed = 20261018;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const round = (v: number) => Math.round(v * 100) / 100;
  return Array.from({ length: 30 }, (_, i) => {
    const overText = i % 3 === 0;
    return {
      x: round(overText ? 52 + random() * 46 : random() * 52),
      y: round(2 + 58 * random() ** 1.5),
      size: round(0.8 + random() * random() * 1.2),
      opacity: round(overText ? 0.3 + random() * 0.25 : 0.45 + random() * 0.5),
      duration: round(5 + random() * 6),
      delay: round(random() * 11),
    };
  });
})();

// High, slow cirrus; a low bank resting above the hills; a small wisp between them.
const clouds = [
  { name: "cirrus", ratio: 7.627, top: 7, width: 72, duration: 460, phase: 0.22, opacity: 0.45 },
  { name: "wisp", ratio: 7.041, top: 27, width: 44, duration: 380, phase: 0.74, opacity: 0.5 },
  { name: "stratus", ratio: 6.237, top: 49, width: 96, duration: 320, phase: 0.48, opacity: 0.6 },
];

// Ridgelines in percent of the 16:9 painting, drawn as smooth curves through the points. The far ridge
// dips into a valley where the sun sets (x 57%); olives and cypresses on the nearer ones give scale.
type Point = [number, number];
const crestAt = (points: Point[], x: number) => {
  const i = Math.max(0, points.findIndex(([px]) => px >= x) - 1);
  const [[x0, y0], [x1, y1]] = [points[i], points[i + 1]];
  return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
};
const ridge = (points: Point[], cypresses: number[] = [], olives: number[] = []) => {
  const p = points.map(([x, y]) => [x * 16, y * 9]);
  const n = (v: number) => Math.round(v * 10) / 10;
  let d = `M0 900L${p[0][0]} ${p[0][1]}`;
  for (let i = 0; i < p.length - 1; i++) {
    const [a, b, c, e] = [p[i - 1] ?? p[i], p[i], p[i + 1], p[i + 2] ?? p[i + 1]];
    d += `C${n(b[0] + (c[0] - a[0]) / 6)} ${n(b[1] + (c[1] - a[1]) / 6)} ${n(c[0] - (e[0] - b[0]) / 6)} ${n(c[1] - (e[1] - b[1]) / 6)} ${c[0]} ${n(c[1])}`;
  }
  d += "L1600 900Z";
  for (const x of cypresses) {
    const [cx, cy, h, w] = [x * 16, crestAt(points, x) * 9 + 3, 13 + (x % 1) * 6, 2.6];
    d += `M${n(cx)} ${n(cy - h)}C${n(cx + w)} ${n(cy - h * 0.55)} ${n(cx + w)} ${n(cy)} ${n(cx)} ${n(cy + 2)}C${n(cx - w)} ${n(cy)} ${n(cx - w)} ${n(cy - h * 0.55)} ${n(cx)} ${n(cy - h)}Z`;
  }
  for (const x of olives) {
    const [cx, cy, r] = [x * 16, crestAt(points, x) * 9 + 2, 5 + (x % 1) * 3];
    d += `M${n(cx - r)} ${n(cy)}a${n(r)} ${n(r * 0.8)} 0 1 1 ${n(r * 2)} 0a${n(r)} ${n(r * 0.8)} 0 1 1 ${n(-r * 2)} 0Z`;
  }
  return d;
};
const land = [
  {
    d: ridge([[0, 62], [8, 60.5], [18, 59], [28, 60.5], [38, 63], [46, 66.5], [52, 70.5], [57, 73], [62, 71.5], [68, 68], [75, 65], [83, 62.5], [91, 61], [100, 62]]),
    from: 540,
    to: 700,
  },
  {
    d: ridge([[0, 70], [15, 68], [30, 69.5], [42, 71.5], [50, 73.5], [56, 76], [62, 76.5], [68, 74], [74, 72.5], [81, 73.5], [88, 72], [95, 73], [100, 74]], [66.2, 66.9, 89.4]),
    from: 610,
    to: 760,
  },
  {
    d: ridge(
      [[0, 76], [20, 75], [40, 77], [55, 79], [64, 79.5], [72, 78], [80, 79], [88, 78.5], [95, 80], [100, 81]],
      [85.6, 86.3, 87.1],
      [73.5, 75.2, 76.6, 78.3, 93.4],
    ),
    from: 670,
    to: 820,
  },
];

function Ridges({ layers, id }: { layers: number[]; id: string }) {
  return (
    <svg viewBox="0 0 1600 900" preserveAspectRatio="none" className="sky-land">
      <defs>
        {layers.map((i) => (
          <linearGradient key={i} id={`${id}-${i}`} gradientUnits="userSpaceOnUse" x1="0" y1={land[i].from} x2="0" y2={land[i].to}>
            <stop offset="0" style={{ stopColor: `var(--land-${i + 1})` }} />
            <stop offset="1" style={{ stopColor: `var(--land-${i + 1}-foot)` }} />
          </linearGradient>
        ))}
      </defs>
      {layers.map((i) => (
        <path key={i} d={land[i].d} fill={`url(#${id}-${i})`} />
      ))}
    </svg>
  );
}

/**
 * The house under a sky that follows the real sun: stars and a moon at night, sunrise, birds by day, a sunset.
 * Colors and positions come from the properties src/lib/sky.ts keeps on <html>; this only draws and animates.
 */
export function SkyScene({ ref }: { ref?: Ref<SkySceneHandle> }) {
  const id = "land" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const root = useRef<HTMLDivElement>(null);
  const flyers = useRef<SkyFlyersHandle>(null);
  const now = useRef(() => Date.now());
  const [offscreen, setOffscreen] = useState(false);
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(reducedMotionQuery).matches,
    () => true,
  );
  const sky = useCallback(() => skyAt(now.current()), []);

  useImperativeHandle(ref, () => ({ summon: () => flyers.current?.summon() }), []);

  // Layout effect: after a client-side navigation the sky can be hours old, and must not show for a frame.
  useLayoutEffect(() => {
    let timer = 0;
    let frame = 0;
    const paint = () => paintSky(skyAt(now.current()));
    // Development only: ?sky=05:40 pins the time, ?sky=lapse runs a day a minute.
    const pinned = process.env.NODE_ENV === "development" ? new URLSearchParams(location.search).get("sky") : null;
    if (pinned === "lapse") {
      const start = Date.now();
      now.current = () => start + (Date.now() - start) * 1440;
      const loop = () => {
        paint();
        frame = requestAnimationFrame(loop);
      };
      loop();
    } else {
      const [hours, minutes] = pinned?.split(":").map(Number) ?? [];
      if (Number.isFinite(hours) && Number.isFinite(minutes)) {
        const at = new Date().setHours(hours, minutes, 0, 0);
        now.current = () => at;
      }
      paint();
      timer = window.setInterval(paint, 30_000);
      document.addEventListener("visibilitychange", paint);
    }
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", paint);
    };
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setOffscreen(!entry.isIntersecting));
    observer.observe(root.current!);
    return () => observer.disconnect();
  }, []);

  // Painted with the house on the left; mirrored in LTR so the text side is always the start side.
  return (
    <div
      ref={root}
      aria-hidden
      data-paused={offscreen || undefined}
      className="sky pointer-events-none absolute inset-0 ltr:-scale-x-100"
    >
      <div className="sky-gradient absolute inset-0" />

      <div className="sky-stars">
        {stars.map((star, i) => (
          <span
            key={i}
            className="sky-star"
            style={
              {
                left: `${star.x}%`,
                top: `${star.y}%`,
                width: star.size,
                height: star.size,
                "--o": star.opacity,
                animationDuration: `${star.duration}s`,
                animationDelay: `${-star.delay}s`,
              } as CSSProperties
            }
          />
        ))}
      </div>

      <div className="sky-frame">
        <div className="sky-glow" />
        <div className="sky-moon" />
        <div className="sky-sun" />
      </div>

      <div className="sky-clouds">
        {clouds.map((cloud) => (
          <div
            key={cloud.name}
            className="sky-cloud"
            style={
              {
                top: `${cloud.top}%`,
                width: `${cloud.width}cqh`,
                aspectRatio: cloud.ratio,
                opacity: cloud.opacity,
                maskImage: `url(/illustrations/scene/${cloud.name}.webp)`,
                animationDuration: `${cloud.duration}s`,
                "--phase": cloud.phase * cloud.duration,
              } as CSSProperties
            }
          />
        ))}
      </div>

      <div className="sky-frame">
        <Ridges layers={[0, 1]} id={id} />
      </div>

      <SkyFlyers ref={flyers} enabled={!offscreen && !reducedMotion} sky={sky} />

      <div className="sky-frame">
        <Ridges layers={[2]} id={id} />
        <div className="home" />
        <div className="home home-east" />
        <div className="home home-west" />
        <div className="absolute inset-0 [opacity:var(--sky-windows)]">
          {/* The blur sits on a wrapper: on the masked element itself it would blur before the mask cuts it. */}
          <div className="absolute inset-0 opacity-70 blur-[1cqh]">
            <div className="home-windows bg-[#ffb35c]" />
          </div>
          <div className="home-windows bg-[#ffd7a0]" />
        </div>
      </div>

      <div className="sky-dim" />
      <div className="sky-veil" />
    </div>
  );
}
