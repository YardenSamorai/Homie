"use client";

import {
  useCallback,
  useEffect,
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
  return Array.from({ length: 42 }, (_, i) => {
    const overText = i % 3 === 0;
    return {
      x: round(overText ? 52 + random() * 46 : random() * 52),
      y: round(2 + 64 * random() ** 1.5),
      size: round(1 + random() * 1.3),
      opacity: round(overText ? 0.35 + random() * 0.3 : 0.5 + random() * 0.5),
      duration: round(2.4 + random() * 3.6),
      delay: round(random() * 6),
    };
  });
})();

const sparkles = [
  { x: 22, y: 9, size: 7, duration: 4.2, delay: 0 },
  { x: 47, y: 24, size: 6, duration: 5.1, delay: 1.7 },
  { x: 9, y: 36, size: 5.5, duration: 3.6, delay: 0.8 },
];

const clouds = [
  { name: "cloud-1", ratio: 1.705, top: 5, width: 31, duration: 150, phase: 0.18, opacity: 1 },
  { name: "cloud-3", ratio: 1.959, top: 27, width: 25, duration: 200, phase: 0.62, opacity: 1 },
  { name: "cloud-2", ratio: 1.577, top: 14, width: 17, duration: 260, phase: 0.86, opacity: 0.8 },
];

/**
 * The house under a sky that follows the real sun: stars and a moon at night, sunrise, birds by day, a sunset.
 * Colors and positions come from the properties src/lib/sky.ts keeps on <html>; this only draws and animates.
 */
export function SkyScene({ ref }: { ref?: Ref<SkySceneHandle> }) {
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
        {sparkles.map((sparkle, i) => (
          <svg
            key={i}
            viewBox="0 0 10 10"
            className="sky-sparkle"
            style={{
              left: `${sparkle.x}%`,
              top: `${sparkle.y}%`,
              width: sparkle.size,
              animationDuration: `${sparkle.duration}s`,
              animationDelay: `${-sparkle.delay}s`,
            }}
          >
            <path d="M5 0C5.5 3.5 6.5 4.5 10 5 6.5 5.5 5.5 6.5 5 10 4.5 6.5 3.5 5.5 0 5 3.5 4.5 4.5 3.5 5 0Z" fill="currentColor" />
          </svg>
        ))}
      </div>

      <div className="sky-frame">
        <div className="sky-glow" />
        <div className="sky-moon" />
        <div className="sky-sun" />
      </div>

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
              backgroundImage: `url(/illustrations/sky/${cloud.name}.webp)`,
              maskImage: `url(/illustrations/sky/${cloud.name}.webp)`,
              animationDuration: `${cloud.duration}s`,
              "--phase": cloud.phase * cloud.duration,
            } as CSSProperties
          }
        />
      ))}

      <SkyFlyers ref={flyers} enabled={!offscreen && !reducedMotion} sky={sky} />

      <div className="sky-frame">
        <div className="sky-house" />
        <div className="absolute inset-0 [opacity:var(--sky-windows)]">
          {/* The blur sits on a wrapper: on the masked element itself it would blur before the mask cuts it. */}
          <div className="absolute inset-0 opacity-80 blur-[1.2cqh]">
            <div className="sky-windows bg-[#ffb54f]" />
          </div>
          <div className="sky-windows bg-[#ffd98c]" />
        </div>
        <div className="sky-smoke">
          {[0, 1, 2].map((i) => (
            <span key={i} className="sky-puff" style={{ animationDelay: `${i * -2.4}s` }} />
          ))}
        </div>
      </div>

      <div className="sky-dim" />
      <div className="sky-veil" />
    </div>
  );
}
