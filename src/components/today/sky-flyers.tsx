"use client";

import {
  useCallback,
  useEffect,
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

const sprite = (name: string) => ({ backgroundImage: `url(/illustrations/sky/${name}.webp)` });

function weighted(options: [Kind, number][]): Kind | null {
  let roll = Math.random() * options.reduce((sum, [, weight]) => sum + weight, 0);
  for (const [kind, weight] of options) if ((roll -= weight) < 0) return kind;
  return null;
}

/** What might cross this sky. A tap asks for something now, so it favors the quick and the rare. */
function pick({ elevation, rising }: Sky, summoned: boolean): Kind | null {
  const kind = weighted(
    elevation < -6
      ? summoned
        ? [["shootingStar", 6], ["ufo", 1.5], ["satellite", 1]]
        : [["shootingStar", 4], ["satellite", 3], ["nightPlane", 3], ["ufo", 0.8]]
      : elevation < 6
        ? [
            ["birds", 4],
            ["nightPlane", elevation < 2 && !summoned ? 2 : 0],
            ["balloon", rising && elevation > -1 ? 2 : 0],
            ["plane", elevation > 0 ? 1 : 0],
          ]
        : summoned
          ? [["birds", 5], ["plane", 1], ["kite", 1]]
          : [["birds", 5], ["plane", 3], ["paraglider", 2], ["kite", 2], ["balloon", rising && elevation < 30 ? 1.5 : 0]],
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
    // Often something soon after the screen opens, then a quiet stretch between crossings.
    const forced = process.env.NODE_ENV === "development" && location.search.includes("fly=");
    const soon = launched.current === 0 && Math.random() < 0.6;
    const wait = forced ? 600 : soon ? 2500 + Math.random() * 3500 : 14_000 + Math.random() * 18_000;
    const timer = setTimeout(() => launch(false), wait);
    return () => clearTimeout(timer);
  }, [enabled, flight, launch]);

  if (!flight) return null;
  const Flyer = flyers[flight.kind];
  const framed = flight.kind === "kite" || flight.kind === "paraglider" || flight.kind === "balloon";
  return (
    <div className={framed ? "sky-frame" : "absolute inset-0"}>
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

function Plane({ flight, onDone }: FlyerProps) {
  const [height, drift, pace] = flight.r;
  const y = 6 + height * 8;
  return (
    <Travel flight={flight} onDone={onDone} from={[-18, y]} to={[118, y + (drift - 0.5) * 5]} duration={32 + pace * 10}>
      <div className="relative aspect-[1.582] w-[12cqh]" style={{ translate: "-50% -50%", scale: `${flight.dir} 1` }}>
        <span className="sky-contrail" />
        <div className="sky-sprite absolute inset-0" style={sprite("plane")} />
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
  return (
    <div
      className="sky-ufo"
      style={{ "--hx": `${44 + x * 6}cqw`, "--hy": `${11 + y * 5}cqh` } as CSSProperties}
      onAnimationEnd={ended(onDone)}
    >
      <div className="sky-bob" style={{ animationDuration: "1.2s" }}>
        <div className="relative aspect-[1.516] w-[11cqh]" style={{ translate: "-50% -50%" }}>
          <span className="sky-beam" />
          <div className="sky-sprite absolute inset-0" style={sprite("ufo")} />
        </div>
      </div>
    </div>
  );
}

function Kite({ onDone }: FlyerProps) {
  return (
    <div className="sky-kite" onAnimationEnd={ended(onDone)}>
      <div className="sky-flutter relative aspect-[0.472] w-[6.5cqh]" style={{ translate: "-50% -30%" }}>
        <span className="sky-string" />
        <div className="sky-sprite absolute inset-0" style={sprite("kite")} />
      </div>
    </div>
  );
}

function Paraglider({ onDone }: FlyerProps) {
  return (
    <div className="sky-paraglider" onAnimationEnd={ended(onDone)}>
      <div
        className="sky-sprite sky-sway aspect-[0.965] w-[12cqh]"
        style={{ ...sprite("paraglider"), translate: "-50% -50%", animationDuration: "3.4s" }}
      />
    </div>
  );
}

function Balloon({ onDone }: FlyerProps) {
  return (
    <div className="sky-balloon" onAnimationEnd={ended(onDone)}>
      <div
        className="sky-sprite sky-sway aspect-[0.667] w-[9cqh]"
        style={{ ...sprite("balloon"), translate: "-50% -50%", animationDuration: "4.6s", "--sway": "2.5deg" } as CSSProperties}
      />
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
