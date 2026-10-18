"use client";

import {
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type AnimationEvent,
  type CSSProperties,
  type ReactNode,
  type Ref,
} from "react";
import type { Sky } from "@/lib/sky";

type Kind =
  | "birds"
  | "storks"
  | "plane"
  | "nightPlane"
  | "satellite"
  | "shootingStar"
  | "ufo"
  | "kite"
  | "paraglider"
  | "balloon";

/** One crossing. `r` is drawn when it launches, so each flight varies without randomness during render. */
type Flight = { id: number; kind: Kind; dir: 1 | -1; r: number[]; summoned: boolean };
type FlyerProps = { flight: Flight; onDone: () => void };

export type SkyFlyersHandle = { summon: () => void };

// The spaceship is a secret, not a feature: at most once every twelve hours on this device.
const ufoKey = "homie_ufo_at";
const ufoRested = () => {
  try {
    return Date.now() - Number(localStorage.getItem(ufoKey) ?? 0) > 12 * 3_600_000;
  } catch {
    return false;
  }
};

function weighted(options: [Kind, number][]): Kind | null {
  let roll = Math.random() * options.reduce((sum, [, weight]) => sum + weight, 0);
  for (const [kind, weight] of options) if ((roll -= weight) < 0) return kind;
  return null;
}

/** What might cross this sky. Mostly birds; a tap asks for something now, so it favors the quick and the rare. */
function pick({ elevation, rising }: Sky, summoned: boolean): Kind | null {
  const ufo = ufoRested() ? (summoned ? 0.8 : 0.25) : 0;
  const kind = weighted(
    elevation < -6
      ? summoned
        ? [["shootingStar", 6], ["satellite", 1], ["ufo", ufo]]
        : [["shootingStar", 3], ["satellite", 3], ["nightPlane", 3], ["ufo", ufo]]
      : elevation < 6
        ? [
            ["birds", 4],
            ["nightPlane", elevation < 2 && !summoned ? 2 : 0],
            ["balloon", rising && elevation > -1 ? 1.5 : 0],
            ["plane", elevation > 0 ? 1 : 0],
          ]
        : summoned
          ? [["birds", 5], ["plane", 1], ["kite", 1]]
          : [["birds", 6], ["plane", 2.5], ["paraglider", 1], ["kite", 1], ["balloon", rising && elevation < 30 ? 1 : 0]],
  );
  // Storks fly over Israel on their way south and back in spring and autumn.
  const migrating = [2, 3, 8, 9].includes(new Date().getMonth());
  return kind === "birds" && migrating && Math.random() < 0.5 ? "storks" : kind;
}

/** Birds, planes, a kite, now and then a spaceship: one at a time, picked for the time of day. */
export function SkyFlyers({ enabled, sky, ref }: { enabled: boolean; sky: () => Sky; ref?: Ref<SkyFlyersHandle> }) {
  const [flight, setFlight] = useState<Flight | null>(null);
  const launched = useRef(0);

  const launch = useCallback(
    (summoned: boolean) => {
      // Development only: ?fly=kite sends nothing but kites.
      const forced = process.env.NODE_ENV === "development" && new URLSearchParams(location.search).get("fly");
      const kind = forced && forced in flyers ? (forced as Kind) : pick(sky(), summoned);
      if (!kind) return;
      if (kind === "ufo" && !forced) {
        try {
          localStorage.setItem(ufoKey, String(Date.now()));
        } catch {}
      }
      launched.current += 1;
      setFlight({
        id: launched.current,
        kind,
        dir: Math.random() < 0.5 ? 1 : -1,
        r: Array.from({ length: 8 }, Math.random),
        summoned,
      });
    },
    [sky],
  );

  useImperativeHandle(ref, () => ({ summon: () => enabled && !flight && launch(true) }), [enabled, flight, launch]);

  useEffect(() => {
    if (!enabled || flight) return;
    // The sky opens calm: nothing for the first half minute or so, then long quiet stretches between crossings.
    const forced = process.env.NODE_ENV === "development" && location.search.includes("fly=");
    const first = launched.current === 0;
    const wait = forced ? 600 : first ? 25_000 + Math.random() * 35_000 : 45_000 + Math.random() * 55_000;
    const timer = setTimeout(() => launch(false), wait);
    return () => clearTimeout(timer);
  }, [enabled, flight, launch]);

  if (!flight) return null;
  const Flyer = flyers[flight.kind];
  const framed = flight.kind === "kite" || flight.kind === "paraglider" || flight.kind === "balloon";
  return (
    <div className={framed ? "sky-frame" : "sky-flyway"}>
      <Flyer key={flight.id} flight={flight} onDone={() => setFlight(null)} />
    </div>
  );
}

const ended = (onDone: () => void) => (event: AnimationEvent) => {
  if (event.target === event.currentTarget) onDone();
};

/** A straight crossing, mirrored when the flight goes the other way. */
function Travel({
  flight,
  onDone,
  from,
  to,
  duration,
  children,
}: FlyerProps & { from: [number, number]; to: [number, number]; duration: number; children: ReactNode }) {
  const x = (v: number) => (flight.dir === 1 ? v : 100 - v);
  // A tap is answered at once: start at the edge instead of off-screen.
  const lead = flight.summoned ? Math.max(0, (-from[0] - 2) / (to[0] - from[0])) * duration : 0;
  const style = {
    "--x0": `${x(from[0])}cqw`,
    "--y0": `${from[1]}cqh`,
    "--x1": `${x(to[0])}cqw`,
    "--y1": `${to[1]}cqh`,
    animationDuration: `${duration}s`,
    animationDelay: `${-lead}s`,
  } as CSSProperties;
  return (
    <div className="sky-fly" style={style} onAnimationEnd={ended(onDone)}>
      {children}
    </div>
  );
}

function Birds({ flight, onDone }: FlyerProps) {
  const storks = flight.kind === "storks";
  const [count, height, drift, pace] = flight.r;
  const y = 12 + height * 22;
  const flock = storks
    ? Array.from({ length: 7 }, (_, i) => {
        const rank = Math.ceil(i / 2);
        return { dx: -rank * 6, dy: (i % 2 ? 1 : -1) * rank * 3.4, beat: 2.2, lag: i * 0.18, size: 7 };
      })
    : Array.from({ length: 3 + Math.floor(count * 3) }, (_, i) => {
        const r = flight.r[(i + 4) % flight.r.length];
        return { dx: -i * (3.5 + r * 3), dy: (r - 0.5) * 10, beat: 0.34 + r * 0.14, lag: r, size: 4.8 + r * 1.6 };
      });
  return (
    <Travel
      flight={flight}
      onDone={onDone}
      from={[-12, y]}
      to={[112, y + (drift - 0.5) * 14]}
      duration={storks ? 24 + pace * 6 : 15 + pace * 6}
    >
      {flock.map((bird, i) => (
        <div key={i} className="absolute" style={{ translate: `${bird.dx * flight.dir}cqh ${bird.dy}cqh` }}>
          <div className="sky-bob" style={{ animationDuration: `${1.8 + bird.lag}s`, animationDelay: `${-bird.lag * 2}s` }}>
            <svg
              viewBox="0 0 12 6"
              className={`sky-bird ${storks ? "sky-flap-glide" : "sky-flap"}`}
              style={{ width: `${bird.size}cqh`, animationDuration: `${bird.beat}s`, animationDelay: `${-bird.lag}s` }}
            >
              <path
                d="M1 4.6Q3.4 1 6 4.1Q8.6 1 11 4.6"
                fill="none"
                stroke="currentColor"
                strokeWidth={storks ? 1.1 : 1.3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      ))}
    </Travel>
  );
}

/** A high airliner: a silver glint trailing a fine contrail, nose toward the direction of travel. */
function Plane({ flight, onDone }: FlyerProps) {
  const [height, drift, pace] = flight.r;
  const y = 6 + height * 8;
  return (
    <Travel flight={flight} onDone={onDone} from={[-18, y]} to={[118, y + (drift - 0.5) * 5]} duration={36 + pace * 12}>
      <div className="relative aspect-[48/14] w-[8cqh]" style={{ translate: "-50% -50%", scale: `${flight.dir} 1` }}>
        <span className="sky-contrail" />
        <svg viewBox="0 0 48 14" className="absolute inset-0 size-full overflow-visible">
          <path d="M11 6.5 4.6 1.2H2.3l2.3 6.1Z" fill="#dce2e9" />
          <path d="M3.6 7.2 40.5 6.1Q46.6 6.3 47.4 7.6 46.4 8.9 40.5 9L6.2 9.1Q4 8.6 3.6 7.2Z" fill="#f4f6f9" />
          <path d="M19 8.7h7.6l-5 4.5H19Z" fill="#c5ccd6" />
          <path d="M3.4 8h5.4l-2.6 2.2H4.4Z" fill="#d2d8e0" />
        </svg>
      </div>
    </Travel>
  );
}

function NightPlane({ flight, onDone }: FlyerProps) {
  const [height, drift, pace] = flight.r;
  const y = 6 + height * 14;
  return (
    <Travel flight={flight} onDone={onDone} from={[-6, y]} to={[106, y + (drift - 0.5) * 6]} duration={38 + pace * 12}>
      <span className="sky-light bg-white/60" />
      <span className="sky-light sky-blink bg-[#ff5a4f]" style={{ translate: `${-1.4 * flight.dir}cqh 0.5cqh` }} />
      <span className="sky-light sky-strobe bg-white" style={{ translate: `${1.4 * flight.dir}cqh 0.5cqh` }} />
    </Travel>
  );
}

function Satellite({ flight, onDone }: FlyerProps) {
  const [height, drift, pace] = flight.r;
  const y = 5 + height * 24;
  const duration = 24 + pace * 10;
  return (
    <Travel flight={flight} onDone={onDone} from={[-3, y]} to={[103, y + (drift - 0.3) * 20]} duration={duration}>
      <span className="sky-satellite" style={{ animationDuration: `${duration}s` }} />
    </Travel>
  );
}

function ShootingStar({ flight, onDone }: FlyerProps) {
  const [x, y, slope, size] = flight.r;
  const angle = 14 + slope * 20;
  const length = 13 + size * 9;
  return (
    <div
      className="absolute"
      style={{ left: `${8 + x * 48}%`, top: `${4 + y * 22}%`, rotate: `${flight.dir === 1 ? angle : 180 - angle}deg` }}
    >
      <span
        className="sky-meteor"
        style={{ width: `${length}cqh`, "--d": `${length * 1.5}cqh` } as CSSProperties}
        onAnimationEnd={onDone}
      />
    </div>
  );
}

function Ufo({ flight, onDone }: FlyerProps) {
  const [x, y] = flight.r;
  const hull = useId();
  return (
    <div
      className="sky-ufo"
      style={{ "--hx": `${44 + x * 6}cqw`, "--hy": `${11 + y * 5}cqh` } as CSSProperties}
      onAnimationEnd={ended(onDone)}
    >
      <div className="sky-bob" style={{ animationDuration: "2.4s" }}>
        <div className="relative aspect-[40/18] w-[9cqh]" style={{ translate: "-50% -50%" }}>
          <span className="sky-beam" />
          <svg viewBox="0 0 40 18" className="absolute inset-0 size-full overflow-visible">
            <defs>
              <linearGradient id={hull} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#eef1f6" />
                <stop offset="1" stopColor="#7d8698" />
              </linearGradient>
            </defs>
            <path d="M13.5 8.4Q14.5 2 20 2t6.5 6.4Z" fill="rgb(206 228 246 / 0.85)" />
            <ellipse cx="20" cy="9.6" rx="18.5" ry="3.9" fill={`url(#${hull})`} />
            <ellipse cx="20" cy="8.3" rx="12" ry="1" fill="rgb(255 255 255 / 0.55)" />
            {[9, 16, 24, 31].map((cx, i) => (
              <circle key={cx} cx={cx} cy="10.7" r="0.9" fill="#ffe2a0" className="sky-blink" style={{ animationDelay: `${-i * 0.35}s` }} />
            ))}
          </svg>
        </div>
      </div>
    </div>
  );
}

function Kite({ onDone }: FlyerProps) {
  return (
    <div className="sky-kite" onAnimationEnd={ended(onDone)}>
      <div className="sky-flutter relative aspect-[20/42] w-[6cqh]" style={{ translate: "-50% -30%" }}>
        <span className="sky-string" />
        <svg viewBox="0 0 20 42" className="absolute inset-0 size-full overflow-visible">
          <path d="M10 1 2 11.5 10 25Z" fill="#b2604a" />
          <path d="M10 1 18 11.5 10 25Z" fill="#d49678" />
          <path d="M10 1v24M2 11.5h16" stroke="rgb(60 40 32 / 0.4)" strokeWidth="0.5" />
          <path d="M10 25q-2.4 3 0 6t0 6q-1.4 2.4 0 4.6" fill="none" stroke="rgb(240 232 220 / 0.85)" strokeWidth="0.6" />
          <path d="M8.5 30.2 10 31.2l1.5-1v2l-1.5-1-1.5 1ZM8.5 36.2 10 37.2l1.5-1v2l-1.5-1-1.5 1Z" fill="#efe4d2" />
        </svg>
      </div>
    </div>
  );
}

function Paraglider({ onDone }: FlyerProps) {
  const [cloth, canopy] = [useId(), useId()];
  return (
    <div className="sky-paraglider" onAnimationEnd={ended(onDone)}>
      <div className="sky-sway aspect-[30/31] w-[11cqh]" style={{ translate: "-50% -50%", animationDuration: "3.8s" }}>
        <svg viewBox="0 0 30 31" className="size-full overflow-visible">
          <defs>
            <linearGradient id={cloth} x1="0" x2="1">
              <stop offset="0" stopColor="#a5543e" />
              <stop offset="0.5" stopColor="#d6855e" />
              <stop offset="1" stopColor="#a5543e" />
            </linearGradient>
            <clipPath id={canopy}>
              <path d="M1.5 10.5Q15-4 28.5 10.5L26.6 12Q15 1 3.4 12Z" />
            </clipPath>
          </defs>
          <g clipPath={`url(#${canopy})`}>
            <rect width="30" height="13" fill={`url(#${cloth})`} />
            <path d="M9.2 0h1.6v13H9.2ZM19.2 0h1.6v13h-1.6Z" fill="#f0e6d5" />
          </g>
          <path d="M3.4 12 15 25.4M8.8 7.6 15 25.4M21.2 7.6 15 25.4M26.6 12 15 25.4" stroke="rgb(64 56 60 / 0.4)" strokeWidth="0.35" />
          <circle cx="15" cy="25.1" r="1" fill="#3a3942" />
          <path d="M14 26.1h2l.4 3.3h-2.8Z" fill="#3a3942" />
        </svg>
      </div>
    </div>
  );
}

function Balloon({ onDone }: FlyerProps) {
  const [envelope, shade] = [useId(), useId()];
  return (
    <div className="sky-balloon" onAnimationEnd={ended(onDone)}>
      <div
        className="sky-sway aspect-[20/30] w-[8cqh]"
        style={{ translate: "-50% -50%", animationDuration: "4.6s", "--sway": "2.5deg" } as CSSProperties}
      >
        <svg viewBox="0 0 20 30" className="size-full overflow-visible">
          <defs>
            <clipPath id={envelope}>
              <path d="M10 1c5.6 0 9 4.2 9 8.8s-4.2 8.2-6.6 11.6H7.6C5.2 18 1 14.4 1 9.8S4.4 1 10 1Z" />
            </clipPath>
            <radialGradient id={shade} cx="0.35" cy="0.3" r="0.8">
              <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
              <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
              <stop offset="1" stopColor="#1d2238" stopOpacity="0.35" />
            </radialGradient>
          </defs>
          <g clipPath={`url(#${envelope})`}>
            <rect width="20" height="22" fill="#b9654a" />
            <path d="M10 1Q3.6 10 8.6 21.6h1Q7.2 10 10 1ZM10 1q6.4 9 1.4 20.6h-1Q12.8 10 10 1Z" fill="#efe4d1" />
            <rect width="20" height="22" fill={`url(#${shade})`} />
          </g>
          <path d="M7.9 21.4 8.6 25M12.1 21.4 11.4 25" stroke="rgb(60 48 40 / 0.6)" strokeWidth="0.35" />
          <rect x="8.3" y="25" width="3.4" height="2.6" rx="0.4" fill="#6b5240" />
        </svg>
      </div>
    </div>
  );
}

const flyers: Record<Kind, (props: FlyerProps) => ReactNode> = {
  birds: Birds,
  storks: Birds,
  plane: Plane,
  nightPlane: NightPlane,
  satellite: Satellite,
  shootingStar: ShootingStar,
  ufo: Ufo,
  kite: Kite,
  paraglider: Paraglider,
  balloon: Balloon,
};
