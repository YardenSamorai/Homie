"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, type Easing } from "motion/react";
import type { Period } from "@/lib/period";

/*
 * The phone is 390×844 and so is the scene, so one scene unit is one pixel on the wide shot.
 * The camera is the SVG viewBox: its width shrinks from the whole street to the inside of the doorway,
 * which keeps every edge sharp at any zoom.
 */
const W = 390;
const H = 844;
/** Camera width once the doorway covers the whole phone. */
const END = 22;
/** The point the camera flies into: the middle of the doorway. */
const AIM = { x: 195, y: 594 };
const DOOR = { x: 169, w: 52, spring: 568, r: 26, bottom: 640 };
const FOCAL = 260;
const SWING = (104 * Math.PI) / 180;
/** Camera width at the door close-up, where the short version starts. */
const CLOSE = 128;
/** The room's warm light is full until this camera width and gone by the end of the flight. */
const ROOM = 116;

export type DoorVariant = "full" | "short";

/**
 * The full walk up from the street, or (on later opens the same day) only the door opening.
 * `lightsAt` null: the windows are already lit.
 */
const timelines = {
  full: {
    duration: 2.3,
    camera: [W, CLOSE, ROOM, END],
    times: [0, 0.48, 0.66, 1],
    ease: [[0.5, 0, 0.2, 1], "linear", [0.7, 0, 0.25, 1]] as Easing[],
    doorAt: 0.95,
    lightsAt: 0.25 as number | null,
    fadeIn: 0.35,
  },
  short: {
    duration: 1.3,
    camera: [CLOSE, ROOM, END],
    times: [0, 0.3, 1],
    ease: ["linear", [0.7, 0, 0.25, 1]] as Easing[],
    doorAt: 0.1,
    lightsAt: null as number | null,
    fadeIn: 0.2,
  },
} satisfies Record<DoorVariant, unknown>;

const HOLE = "M169 640V568A26 26 0 0 1 221 568V640Z";
const SURROUND = "M162 640V568A33 33 0 0 1 228 568V640Z";
const WALL = "M70 640V392L195 250L320 392V640Z";

type Look = {
  sky: [string, string, string];
  sun: { x: number; y: number; r: number; color: string; glow: string } | null;
  clouds: boolean;
  hillFar: string;
  hillNear: string;
  tree: string;
  treeDark: string;
  lawn: [string, string];
  tint: { color: string; opacity: number } | null;
  lit: number;
  halo: number;
  door: string;
  doorDark: string;
  muntin: string;
  smoke: string;
};

const looks: Record<Period, Look> = {
  morning: {
    sky: ["#a9c9e2", "#e9dccb", "#f8d9b6"],
    sun: { x: 84, y: 214, r: 22, color: "#fff3dc", glow: "#ffd9a0" },
    clouds: true,
    hillFar: "#b5cdb7",
    hillNear: "#9dbea2",
    tree: "#7aa486",
    treeDark: "#628f72",
    lawn: ["#a6c690", "#8db27b"],
    tint: { color: "#f2a65a", opacity: 0.06 },
    lit: 0.75,
    halo: 0.2,
    door: "#2f5d4f",
    doorDark: "#1a362e",
    muntin: "#fbf6ec",
    smoke: "#ffffff",
  },
  afternoon: {
    sky: ["#7fb5dc", "#bcd9ea", "#e6f0ee"],
    sun: { x: 306, y: 118, r: 20, color: "#fffaf0", glow: "#fff0c8" },
    clouds: true,
    hillFar: "#a9c8b0",
    hillNear: "#8fb898",
    tree: "#6f9e7e",
    treeDark: "#5a8a6b",
    lawn: ["#9cc487", "#84ae73"],
    tint: null,
    lit: 0.6,
    halo: 0.1,
    door: "#2f5d4f",
    doorDark: "#1a362e",
    muntin: "#fbf6ec",
    smoke: "#ffffff",
  },
  evening: {
    sky: ["#6f6fa8", "#e59a82", "#f9cf9c"],
    sun: { x: 334, y: 262, r: 26, color: "#ffc58a", glow: "#ffa86e" },
    clouds: false,
    hillFar: "#9c8fa3",
    hillNear: "#7f8f88",
    tree: "#5f7f70",
    treeDark: "#4b6a5c",
    lawn: ["#8ea67e", "#76906a"],
    tint: { color: "#d0683f", opacity: 0.12 },
    lit: 1,
    halo: 0.5,
    door: "#2a5346",
    doorDark: "#16302a",
    muntin: "#f1dccb",
    smoke: "#f4dccb",
  },
  night: {
    sky: ["#1e2a55", "#2f3d6e", "#4d5c8c"],
    sun: null,
    clouds: false,
    hillFar: "#4a5878",
    hillNear: "#3d4c6a",
    tree: "#4a6a62",
    treeDark: "#3b5751",
    lawn: ["#5d7a6c", "#4a6558"],
    tint: { color: "#141c3c", opacity: 0.42 },
    lit: 1,
    halo: 0.75,
    door: "#1f3a36",
    doorDark: "#0f1f1c",
    muntin: "#6a6f8e",
    smoke: "#8f98b8",
  },
};

const STONE = "#e4dacb";
const STONE_DARK = "#d2c5b1";
const TRIM = "#fffaf2";
const ROOF = "#5a7c6c";
const ROOF_DARK = "#3f5d50";

/* ---------- the door leaf, projected as it swings into the house ---------- */

type Pt = readonly [number, number];

const ARCH: Pt[] = Array.from({ length: 13 }, (_, i) => {
  const phi = Math.PI - (i * Math.PI) / 12;
  return [0.5 + 0.5 * Math.cos(phi), DOOR.spring - DOOR.r * Math.sin(phi)];
});
const OUTLINE: Pt[] = [[0, DOOR.bottom], ...ARCH, [1, DOOR.bottom]];
const FAN: Pt[] = Array.from({ length: 13 }, (_, i) => {
  const phi = Math.PI - (i * Math.PI) / 12;
  return [0.5 + (17 * Math.cos(phi)) / DOOR.w, 572 - 17 * Math.sin(phi)];
});
const rect = (u0: number, u1: number, y0: number, y1: number): Pt[] => [
  [u0, y0],
  [u1, y0],
  [u1, y1],
  [u0, y1],
];
const PANELS = [
  rect(0.14, 0.45, 580, 604),
  rect(0.55, 0.86, 580, 604),
  rect(0.14, 0.45, 612, 632),
  rect(0.55, 0.86, 612, 632),
  rect(0.49, 0.51, 555, 572),
];
const BRASS = [rect(0.3, 0.7, 606.5, 609.5), rect(0.06, 0.94, 635, 638.5)];
const KNOB: Pt = [0.92, 597];

/** A point on the leaf (u across its width, y down the wall), after the leaf turns `angle` on its hinge. */
function project([u, y]: Pt, angle: number) {
  const along = u * DOOR.w;
  const x = DOOR.x + along * Math.cos(angle);
  const depth = FOCAL / (FOCAL + along * Math.sin(angle));
  return { x: AIM.x + (x - AIM.x) * depth, y: AIM.y + (y - AIM.y) * depth, depth };
}

function pathOf(points: Pt[], angle: number) {
  return (
    points
      .map((point, i) => {
        const { x, y } = project(point, angle);
        return `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join("") + "Z"
  );
}

function mix(from: string, to: string, t: number) {
  const a = parseInt(from.slice(1), 16);
  const b = parseInt(to.slice(1), 16);
  const channel = (shift: number) => Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t);
  return `rgb(${channel(16)} ${channel(8)} ${channel(0)})`;
}

/** Where the camera looks: the whole street, then the door, then the middle of the doorway. */
function centerY(w: number) {
  if (w >= 128) return 422 + ((580 - 422) * (W - w)) / (W - 128);
  return 580 + ((AIM.y - 580) * (128 - w)) / (128 - END);
}

/* ---------- the scene ---------- */

const siding = Array.from({ length: 27 }, (_, i) => {
  const y = 278 + i * 13;
  let x0 = 70;
  let x1 = 320;
  if (y < 392) {
    const half = ((y - 250) / 142) * 125;
    x0 = 195 - half + 4;
    x1 = 195 + half - 4;
  }
  return y > 532 ? `M${x0} ${y}H162M228 ${y}H${x1}` : `M${x0} ${y}H${x1}`;
}).join("");

const roofCourses = [0.34, 0.67]
  .map((t) => `M${30 + 18 * t} ${410 + 10 * t}L195 ${240 + 28 * t}L${360 - 18 * t} ${410 + 10 * t}`)
  .join("");

const pathJoints = [690, 726, 770, 822]
  .map((y) => {
    const spread = ((y - 661) * 70) / 239;
    return `M${160 - spread} ${y}H${230 + spread}`;
  })
  .join("");

const flowers = ["#e98b7b", "#f4c25a", "#f2a1b3"];

function WindowBox({ x }: { x: number }) {
  return (
    <>
      <rect x={x + 2} y={471} width={54} height={88} rx={2} fill="#000" fillOpacity={0.06} />
      <rect x={x} y={468} width={54} height={88} rx={2} fill={TRIM} />
      <rect x={x + 5} y={473} width={44} height={78} rx={1} fill="url(#hd-glass-day)" />
      <rect x={x - 6} y={554} width={66} height={5} rx={1.5} fill={STONE} />
      <rect x={x} y={559} width={54} height={12} rx={2} fill="#8a6a52" />
      {Array.from({ length: 8 }, (_, i) => (
        <circle key={`leaf-${i}`} cx={x + 4 + i * 6.6} cy={558} r={4.2} fill="#6f9e6a" />
      ))}
      {Array.from({ length: 7 }, (_, i) => (
        <circle key={`bloom-${i}`} cx={x + 7 + i * 6.6} cy={555 - (i % 2) * 2} r={2.6} fill={flowers[i % 3]} />
      ))}
    </>
  );
}

function Bushes({ look }: { look: Look }) {
  const left = [
    [80, 628, 20],
    [104, 634, 16],
    [58, 636, 16],
  ] as const;
  return (
    <>
      {left.flatMap(([x, y, r]) => [
        <circle key={`l-${x}`} cx={x} cy={y} r={r} fill={look.treeDark} />,
        <circle key={`r-${x}`} cx={390 - x} cy={y} r={r} fill={look.treeDark} />,
        <circle key={`lh-${x}`} cx={x - r * 0.25} cy={y - r * 0.3} r={r * 0.6} fill={look.tree} />,
        <circle key={`rh-${x}`} cx={390 - x - r * 0.25} cy={y - r * 0.3} r={r * 0.6} fill={look.tree} />,
      ])}
      {[140, 250].map((x) => (
        <g key={x}>
          <circle cx={x} cy={620} r={11} fill={look.treeDark} />
          <circle cx={x - 3} cy={617} r={6.5} fill={look.tree} />
          <rect x={x - 1} y={628} width={2} height={6} fill="#7d6250" />
          <path d={`M${x - 8} 636H${x + 8}L${x + 6} 652H${x - 6}Z`} fill="#c47f62" />
          <rect x={x - 9} y={633} width={18} height={4} rx={1} fill="#b06e53" />
        </g>
      ))}
    </>
  );
}

/** The picket fence sits nearer the camera than the house, so it rushes past first. */
function Fence({ look }: { look: Look }) {
  const pickets: number[] = [];
  for (let x = -24; x < 414; x += 15) if (x < 132 || x > 250) pickets.push(x);
  const blooms = Array.from({ length: 26 }, (_, i) => {
    const x = -10 + i * 16.5;
    return x > 128 && x < 256 ? null : (
      <circle key={i} cx={x + (i % 3) * 3} cy={694 - (i % 2) * 4} r={3.2} fill={flowers[i % 3]} />
    );
  });
  return (
    <>
      {Array.from({ length: 22 }, (_, i) => {
        const x = -14 + i * 20;
        return x > 124 && x < 262 ? null : <circle key={i} cx={x} cy={700} r={10} fill={look.treeDark} />;
      })}
      {blooms}
      <path d="M-30 716H138M252 716H420M-30 734H138M252 734H420" stroke="#e9e0d2" strokeWidth={5} />
      {pickets.map((x) => (
        <path
          key={x}
          d={`M${x} 752V704L${x + 4.5} 698L${x + 9} 704V752Z`}
          fill={TRIM}
          stroke="#ddd2c1"
          strokeWidth={0.8}
        />
      ))}
      {[134, 247].map((x) => (
        <g key={x}>
          <rect x={x} y={692} width={11} height={62} rx={1} fill={TRIM} stroke="#ddd2c1" strokeWidth={0.8} />
          <rect x={x - 1.5} y={688} width={14} height={5} rx={1} fill="#efe7da" />
        </g>
      ))}
    </>
  );
}

function Tree({ x, look, flip }: { x: number; look: Look; flip?: boolean }) {
  const side = flip ? -1 : 1;
  return (
    <>
      <rect x={x - 4} y={530} width={8} height={100} rx={3} fill="#7d6250" />
      <circle cx={x} cy={498} r={38} fill={look.treeDark} />
      <circle cx={x - 22 * side} cy={530} r={27} fill={look.treeDark} />
      <circle cx={x + 22 * side} cy={526} r={28} fill={look.tree} />
      <circle cx={x + 4 * side} cy={466} r={27} fill={look.tree} />
    </>
  );
}

function Cloud({ x, y, scale, duration }: { x: number; y: number; scale: number; duration: number }) {
  return (
    <motion.g
      initial={{ x: 0 }}
      animate={{ x: 14 * scale }}
      transition={{ duration, ease: "linear" }}
      fill="#ffffff"
      fillOpacity={0.78}
    >
      <circle cx={x} cy={y} r={14 * scale} />
      <circle cx={x + 16 * scale} cy={y - 6 * scale} r={18 * scale} />
      <circle cx={x + 34 * scale} cy={y} r={13 * scale} />
      <rect x={x} y={y} width={34 * scale} height={13 * scale} />
    </motion.g>
  );
}

const stars = [
  [40, 70, 0],
  [120, 40, 0.4],
  [210, 90, 0.8],
  [250, 30, 0.2],
  [350, 60, 0.6],
  [80, 160, 1],
  [170, 180, 0.3],
  [360, 210, 0.7],
  [20, 250, 0.5],
] as const;

/** The house wakes up as you walk up: windows, the attic, then the lamp by the door, one after another. */
function Lights({ look, at }: { look: Look; at: number | null }) {
  const on = (step: number, level = look.lit) =>
    at === null
      ? { initial: { opacity: level } }
      : {
          initial: { opacity: 0 },
          animate: { opacity: [0, level, level * 0.75, level] },
          transition: { duration: 0.35, times: [0, 0.4, 0.6, 1], ease: "linear" as const, delay: at + step * 0.15 },
        };
  const halo = (step: number) =>
    at === null
      ? { initial: { opacity: look.halo } }
      : {
          initial: { opacity: 0 },
          animate: { opacity: look.halo },
          transition: { duration: 0.5, ease: "easeOut" as const, delay: at + step * 0.15 },
        };
  return (
    <>
      <motion.circle cx={119} cy={512} r={62} fill="url(#hd-halo)" {...halo(0)} />
      <motion.circle cx={271} cy={512} r={62} fill="url(#hd-halo)" {...halo(1)} />
      <motion.circle cx={195} cy={335} r={44} fill="url(#hd-halo)" {...halo(2)} />
      <motion.circle cx={195} cy={520} r={40} fill="url(#hd-halo)" {...halo(3)} />
      <motion.rect x={97} y={473} width={44} height={78} rx={1} fill="url(#hd-glass)" {...on(0)} />
      <motion.rect x={249} y={473} width={44} height={78} rx={1} fill="url(#hd-glass)" {...on(1)} />
      <motion.circle cx={195} cy={335} r={18} fill="url(#hd-glass)" {...on(2)} />
      <motion.rect x={191.5} y={514} width={7} height={10} rx={1.5} fill="#ffe0a0" {...on(3, 1)} />
      <g stroke={look.muntin} strokeWidth={3} strokeLinecap="square">
        <path d="M119 473V551M97 512H141M271 473V551M249 512H293" />
        <path d="M177 335H213M195 317V353" strokeWidth={2.5} />
      </g>
    </>
  );
}

/**
 * Walks up to the house and through its front door into `targetRef`, the screen waiting inside.
 * While it plays, `targetRef` is moved and scaled as if it sat deeper than the door, and stays hidden
 * until the door starts to open. A tap hurries it through the door. The scene removes itself when done.
 */
export function FrontDoor({
  period,
  variant = "full",
  targetRef,
  onDone,
  className,
}: {
  period: Period;
  variant?: DoorVariant;
  targetRef: React.RefObject<HTMLElement | null>;
  onDone?: () => void;
  className?: string;
}) {
  const look = looks[period];
  const timeline = timelines[variant];
  const svgRef = useRef<SVGSVGElement>(null);
  const roomRef = useRef<SVGPathElement>(null);
  const skyRef = useRef<SVGGElement>(null);
  const starsRef = useRef<SVGGElement>(null);
  const hillsRef = useRef<SVGGElement>(null);
  const treesRef = useRef<SVGGElement>(null);
  const fenceRef = useRef<SVGGElement>(null);
  const brassRef = useRef<SVGPathElement>(null);
  const leafRef = useRef<SVGPathElement>(null);
  const fanRef = useRef<SVGPathElement>(null);
  const panelsRef = useRef<SVGPathElement>(null);
  const knobRef = useRef<SVGCircleElement>(null);
  const spillRef = useRef<SVGPathElement>(null);
  const camera = useMotionValue(timeline.camera[0]);
  const door = useMotionValue(0);
  const [done, setDone] = useState(false);
  const hurry = useRef<(() => void) | null>(null);
  const finished = useRef(onDone);
  useEffect(() => {
    finished.current = onDone;
  });

  useLayoutEffect(() => {
    const box = svgRef.current?.getBoundingClientRect();
    /** Screen pixels per scene unit: the scene covers the screen, cropping whichever side is longer. */
    const fit = box && box.width > 0 ? Math.max(box.width / W, box.height / H) : 1;
    const layers: [SVGGElement | null, number][] = [
      [skyRef.current, 0.15],
      [starsRef.current, 0.15],
      [hillsRef.current, 0.55],
      [treesRef.current, 0.8],
      [fenceRef.current, 1.35],
    ];
    const aim = (w: number) => {
      const k = W / w;
      const h = (w * H) / W;
      const cy = centerY(w);
      svgRef.current?.setAttribute("viewBox", `${AIM.x - w / 2} ${cy - h / 2} ${w} ${h}`);
      for (const [layer, depth] of layers) {
        layer?.setAttribute(
          "transform",
          `translate(${AIM.x} ${cy}) scale(${k ** (depth - 1)}) translate(${-AIM.x} ${-cy})`
        );
      }
      roomRef.current?.setAttribute("opacity", String(0.7 * Math.min(1, Math.max(0, (w - 30) / (ROOM - 30)))));
      if (targetRef.current) {
        const scale = (END / w) ** 0.7;
        targetRef.current.style.transform = `translate(0px, ${(AIM.y - cy) * k * fit}px) scale(${scale})`;
      }
    };
    const swing = (p: number) => {
      const angle = p * SWING;
      leafRef.current?.setAttribute("d", pathOf(OUTLINE, angle));
      leafRef.current?.setAttribute("fill", mix(look.door, look.doorDark, p));
      fanRef.current?.setAttribute("d", pathOf(FAN, angle));
      panelsRef.current?.setAttribute("d", PANELS.map((panel) => pathOf(panel, angle)).join(""));
      brassRef.current?.setAttribute("d", BRASS.map((part) => pathOf(part, angle)).join(""));
      const knob = project(KNOB, angle);
      knobRef.current?.setAttribute("cx", String(knob.x));
      knobRef.current?.setAttribute("cy", String(knob.y));
      knobRef.current?.setAttribute("r", String(3.2 * knob.depth));
      spillRef.current?.setAttribute("opacity", String(Math.min(1, p * 1.6) * look.lit * look.lit));
      if (targetRef.current) targetRef.current.style.opacity = p > 0 ? "1" : "0";
    };
    aim(camera.get());
    swing(door.get());
    const offCamera = camera.on("change", aim);
    const offDoor = door.on("change", swing);
    return () => {
      offCamera();
      offDoor();
    };
  }, [camera, door, look, targetRef]);

  useEffect(() => {
    const motions = [
      animate(camera, timeline.camera, {
        duration: timeline.duration,
        times: timeline.times,
        ease: timeline.ease,
      }),
      animate(door, 1, { duration: 0.85, ease: [0.3, 0.6, 0.2, 1], delay: timeline.doorAt }),
    ];
    let timer = 0;
    const finish = (ms: number) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        setDone(true);
        finished.current?.();
      }, ms);
    };
    finish(timeline.duration * 1000 + 30);
    hurry.current = () => {
      hurry.current = null;
      for (const motion of motions) motion.stop();
      motions.push(
        animate(camera, END, { duration: 0.45, ease: [0.7, 0, 0.25, 1] }),
        animate(door, 1, { duration: 0.3, ease: [0.3, 0.6, 0.2, 1] })
      );
      finish(480);
    };
    return () => {
      hurry.current = null;
      for (const motion of motions) motion.stop();
      window.clearTimeout(timer);
    };
  }, [camera, door, timeline]);

  if (done) return null;
  return (
    <motion.svg
      ref={svgRef}
      aria-hidden
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      className={className}
      onPointerDown={() => hurry.current?.()}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: timeline.fadeIn, ease: "easeOut" }}
    >
      <defs>
        <linearGradient id="hd-sky" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="620">
          <stop offset="0" stopColor={look.sky[0]} />
          <stop offset="0.55" stopColor={look.sky[1]} />
          <stop offset="1" stopColor={look.sky[2]} />
        </linearGradient>
        <radialGradient id="hd-sun">
          <stop offset="0" stopColor={look.sun?.glow ?? "#fff"} stopOpacity="0.7" />
          <stop offset="1" stopColor={look.sun?.glow ?? "#fff"} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="hd-moon">
          <stop offset="0" stopColor="#dfe4ff" stopOpacity="0.45" />
          <stop offset="1" stopColor="#dfe4ff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="hd-lawn" gradientUnits="userSpaceOnUse" x1="0" y1="606" x2="0" y2="844">
          <stop offset="0" stopColor={look.lawn[0]} />
          <stop offset="1" stopColor={look.lawn[1]} />
        </linearGradient>
        <linearGradient id="hd-wall" gradientUnits="userSpaceOnUse" x1="70" y1="0" x2="320" y2="0">
          <stop offset="0" stopColor="#f8f2e7" />
          <stop offset="1" stopColor="#ede2d2" />
        </linearGradient>
        <linearGradient id="hd-path" gradientUnits="userSpaceOnUse" x1="0" y1="661" x2="0" y2="844">
          <stop offset="0" stopColor="#e6dccb" />
          <stop offset="1" stopColor="#d3c4ab" />
        </linearGradient>
        <linearGradient id="hd-glass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe7b0" />
          <stop offset="1" stopColor="#f6b65e" />
        </linearGradient>
        <linearGradient id="hd-glass-day" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e2eef1" />
          <stop offset="1" stopColor="#b6cbd3" />
        </linearGradient>
        <radialGradient id="hd-halo">
          <stop offset="0" stopColor="#ffcf7a" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffcf7a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="hd-room" cx="0.5" cy="0.55" r="0.65">
          <stop offset="0" stopColor="#fff4dc" />
          <stop offset="1" stopColor="#f3bd78" />
        </radialGradient>
        <linearGradient id="hd-spill" gradientUnits="userSpaceOnUse" x1="0" y1="640" x2="0" y2="780">
          <stop offset="0" stopColor="#ffd48a" stopOpacity="0.75" />
          <stop offset="1" stopColor="#ffd48a" stopOpacity="0" />
        </linearGradient>
        <clipPath id="hd-cut">
          <path d={`M-3000 -3000H3000V3000H-3000Z${HOLE}`} clipRule="evenodd" />
        </clipPath>
        <clipPath id="hd-hole">
          <path d={HOLE} />
        </clipPath>
        <clipPath id="hd-wall-clip">
          <path d={WALL} />
        </clipPath>
      </defs>

      <g clipPath="url(#hd-cut)">
        <g ref={skyRef}>
          <rect x={-1200} y={-1600} width={2800} height={4200} fill="url(#hd-sky)" />
          {look.sun && (
            <motion.g
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <circle cx={look.sun.x} cy={look.sun.y} r={look.sun.r * 3.4} fill="url(#hd-sun)" />
              <circle cx={look.sun.x} cy={look.sun.y} r={look.sun.r} fill={look.sun.color} />
            </motion.g>
          )}
          {look.clouds && (
            <>
              <Cloud x={232} y={170} scale={1} duration={timeline.duration} />
              <Cloud x={24} y={292} scale={0.75} duration={timeline.duration} />
            </>
          )}
        </g>
        <g ref={hillsRef}>
          <path d="M-300 560C-100 470 60 470 180 520S420 470 700 540V1500H-300Z" fill={look.hillFar} />
          <path d="M-300 600C-40 540 120 560 240 580S480 540 700 590V1500H-300Z" fill={look.hillNear} />
        </g>
        <g ref={treesRef}>
          <Tree x={32} look={look} />
          <Tree x={360} look={look} flip />
        </g>
        <path d="M-600 626Q195 604 990 626V1600H-600Z" fill="url(#hd-lawn)" />

        <rect x={262} y={282} width={22} height={70} fill="#c47f62" />
        <rect x={258} y={276} width={30} height={8} rx={1.5} fill="#8f5a46" />
        {[0, 0.75, 1.5].map((delay) => (
          <motion.circle
            key={delay}
            cx={273}
            fill={look.smoke}
            initial={{ cy: 270, r: 4, opacity: 0 }}
            animate={{ cy: 222, r: 13, opacity: [0, 0.5, 0] }}
            transition={{ duration: 2.2, ease: "easeOut", delay, repeat: Infinity }}
          />
        ))}

        <path d={WALL} fill="url(#hd-wall)" />
        <path d={siding} stroke="#000" strokeOpacity={0.05} strokeWidth={1} fill="none" clipPath="url(#hd-wall-clip)" />
        <path
          d="M54 424L195 278L336 424"
          stroke="#000"
          strokeOpacity={0.07}
          strokeWidth={10}
          fill="none"
          clipPath="url(#hd-wall-clip)"
        />
        <path d="M195 240L30 410L48 420L195 268L342 420L360 410Z" fill={ROOF} />
        <path d={roofCourses} stroke={ROOF_DARK} strokeOpacity={0.45} strokeWidth={1.2} fill="none" />
        <path d="M30 410L195 240L360 410" stroke="#7c9d8c" strokeWidth={2} strokeLinejoin="round" fill="none" />
        <path d="M48 420L195 268L342 420" stroke={TRIM} strokeWidth={2.5} strokeLinejoin="round" fill="none" />

        <circle cx={195} cy={335} r={23} fill={TRIM} />
        <circle cx={195} cy={335} r={18} fill="url(#hd-glass-day)" />
        <WindowBox x={92} />
        <WindowBox x={244} />

        <path d="M195 504V512" stroke="#3b4a44" strokeWidth={1.6} />
        <path d="M188 512H202L199.5 526H190.5Z" fill="#3b4a44" />
        <path d={`${SURROUND}${HOLE}`} fill={STONE} fillRule="evenodd" />
        <path d="M189 531H201L199 545H191Z" fill={STONE_DARK} />
        <rect x={70} y={628} width={92} height={12} fill={STONE_DARK} />
        <rect x={228} y={628} width={92} height={12} fill={STONE_DARK} />

        <path d="M160 661H230L300 900H90Z" fill="url(#hd-path)" />
        <path d={pathJoints} stroke="#c3b297" strokeOpacity={0.6} strokeWidth={1.2} />
        <rect x={150} y={650} width={90} height={11} rx={1.5} fill={STONE_DARK} />
        <rect x={158} y={640} width={74} height={10} rx={1.5} fill={STONE} />
        <path d="M150 650.5H240M158 640.5H232" stroke="#f5efe5" strokeWidth={1} />
        <rect x={174} y={641} width={42} height={5} rx={1} fill="#9b7b5f" />
        <Bushes look={look} />
        <g ref={fenceRef}>
          <Fence look={look} />
        </g>

        {look.tint && (
          <rect x={-3000} y={-3000} width={6000} height={6000} fill={look.tint.color} opacity={look.tint.opacity} />
        )}
        {period === "night" && (
          <g ref={starsRef}>
            <circle cx={306} cy={128} r={64} fill="url(#hd-moon)" />
            <circle cx={306} cy={128} r={19} fill="#f4f1e2" />
            <circle cx={300} cy={123} r={4} fill="#e2ddc8" />
            <circle cx={312} cy={134} r={2.6} fill="#e2ddc8" />
            {stars.map(([x, y, delay]) => (
              <motion.circle
                key={`${x}-${y}`}
                cx={x}
                cy={y}
                r={1.7}
                fill="#eef0ff"
                initial={{ opacity: 0.25 }}
                animate={{ opacity: [0.25, 1, 0.4] }}
                transition={{ duration: 1.2, ease: "easeInOut", delay, repeat: Infinity, repeatType: "mirror" }}
              />
            ))}
          </g>
        )}
      </g>

      <Lights look={look} at={timeline.lightsAt} />

      <path ref={roomRef} d={HOLE} fill="url(#hd-room)" opacity={0.7} />
      <g clipPath="url(#hd-hole)">
        <path ref={leafRef} d={pathOf(OUTLINE, 0)} fill={look.door} />
        <path ref={fanRef} d={pathOf(FAN, 0)} fill="url(#hd-glass)" />
        <path ref={panelsRef} fill="#000" fillOpacity={0.18} stroke="#fff" strokeOpacity={0.1} strokeWidth={0.8} />
        <path ref={brassRef} fill="#d9ad57" />
        <circle ref={knobRef} fill="#e2b65e" />
      </g>
      <path ref={spillRef} d="M169 640H221L264 780H126Z" fill="url(#hd-spill)" opacity={0} />
    </motion.svg>
  );
}
