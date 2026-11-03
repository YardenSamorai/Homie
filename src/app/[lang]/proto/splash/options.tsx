"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "motion/react";
import { Bell, RotateCcw } from "lucide-react";
import { HomieMark } from "@/components/brand/homie-mark";
import { Avatar } from "@/components/ui/avatar";
import { easeOut } from "@/lib/motion";
import { periodFor, type Period } from "@/lib/period";
import type { Member } from "@/lib/tasks";
import { useClock } from "@/lib/use-clock";
import { FrontDoor } from "@/components/brand/front-door";

function FrontDoorOpen({ period }: { period: Period }) {
  const today = useRef<HTMLDivElement>(null);
  return (
    <>
      <div aria-hidden className="atmosphere" data-period={period} />
      <div ref={today} className="absolute inset-0" style={{ opacity: 0 }}>
        <TodayContent period={period} start={null} />
      </div>
      <FrontDoor period={period} targetRef={today} className="absolute inset-0 size-full" />
    </>
  );
}

const ICON = 112;
const HOUSE = "M32 15.5 48.5 29V44.5a3.5 3.5 0 0 1-3.5 3.5H19a3.5 3.5 0 0 1-3.5-3.5V29Z";

const yarden: Member = { id: "y", name: "ירדן", color: "var(--indigo)", photo: "/proto/yarden.jpg" };
const yana: Member = { id: "n", name: "יאנה", color: "var(--pink)", photo: null };

const greetings: Record<Period, string> = {
  morning: "בוקר טוב, ירדן",
  afternoon: "צהריים טובים, ירדן",
  evening: "ערב טוב, ירדן",
  night: "לילה טוב, ירדן",
};
const periods: { id: Period; label: string }[] = [
  { id: "morning", label: "בוקר" },
  { id: "afternoon", label: "צהריים" },
  { id: "evening", label: "ערב" },
  { id: "night", label: "לילה" },
];

const options = [
  {
    id: "front",
    title: "ו · דלת הבית",
    lead: "בית מצויר תחת השמיים של השעה. המצלמה מתקרבת, האורות בבית נדלקים, הדלת נפתחת פנימה, ועוברים דרכה אל מסך היום שמחכה בפנים.",
    note: "נבחר ונמצא באפליקציה · כ־2.3 שניות בפתיחה הראשונה של היום, ואחר כך רק הדלת · נגיעה מאיצה",
  },
  {
    id: "sky",
    title: "א · השמיים של השעה",
    lead: "החלון נדלק, אור השעה נפתח מאחור, והאייקון עולה ונעלם לתוך מסך היום.",
    note: "כ־0.8 שנייה · בלי גרסה חדשה",
  },
  {
    id: "door",
    title: "ב · דלת",
    lead: "האייקון גדל עד שהוא ממלא את המסך, ומסך היום מופיע מבעדו.",
    note: "כ־0.85 שנייה · בלי גרסה חדשה",
  },
  {
    id: "draw",
    title: "ג · ציור",
    lead: "הבית מצטייר בקו, החלון נדלק, ונכנסים.",
    note: "כ־1.1 שניות · צריך גרסה חדשה ב־TestFlight: התמונה של iOS תהיה רק רקע, כי הבית מצטייר מאפס",
  },
  {
    id: "home",
    title: "ד · הביתה",
    lead: "קו האדמה נמתח, הבית מצטייר, ושתי נקודות בצבעים שלכם מגיעות מהצדדים אל הדלת. החלון נדלק, והאור שלו שוטף את המסך והופך לשמיים של השעה.",
    note: "כ־1.8 שניות · גרסה חדשה ב־TestFlight · מוצע: המלאה בפתיחה הראשונה של היום, ובשאר הפעמים רק סוף קצר",
  },
  {
    id: "heavens",
    title: "ה · השמיים מצטיירים",
    lead: "הבית מצטייר, ומעליו השמיים של השעה: שמש עולה בבוקר, שמש גבוהה בצהריים, שקיעה בערב, ירח וכוכבים בלילה. משם האור נפתח למסך.",
    note: "כ־1.7 שניות · גרסה חדשה ב־TestFlight · כדאי להחליף בין השעות למעלה",
  },
] as const;

const glows: Record<Period, string> = {
  morning: "#fbe2c6",
  afternoon: "#d9e9f2",
  evening: "#f7d0b8",
  night: "#d6dcf0",
};

/* The wide scene: viewBox -16 0 96 64, centered in the 390×844 phone. */
const SCENE_W = ICON * 2.2;
const SCENE_H = (SCENE_W * 64) / 96;
const toScreen = (vx: number, vy: number) => ({
  x: (vx + 16) * (SCENE_W / 96) - SCENE_W / 2,
  y: vy * (SCENE_W / 96) - SCENE_H / 2,
});

export function SplashOptions() {
  const clock = useClock();
  const [picked, setPeriod] = useState<Period | null>(null);
  const period = picked ?? (clock?.hour != null ? periodFor(clock.hour) : "afternoon");

  return (
    <div className="mx-auto flex w-full max-w-[430px] flex-col items-center gap-10 bg-bg px-4 py-10">
      <header className="w-full text-start">
        <p className="text-[13px] font-semibold text-label-secondary">בחירת כיוון</p>
        <h1 className="mt-1 text-[28px] font-bold tracking-[-0.02em]">פתיחת האפליקציה</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-label-secondary">
          כל טלפון מתחיל מהאייקון הקבוע, כמו שהאייפון מציג אותו, ומתנגן כשמגיעים אליו. אפשר לנגן שוב מתחת לכל אחד.
        </p>
        <div role="radiogroup" aria-label="שעה ביום" className="mt-4 flex gap-1 rounded-full bg-fill p-1">
          {periods.map((item) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={period === item.id}
              onClick={() => setPeriod(item.id)}
              className={`min-h-9 flex-1 rounded-full text-[14px] font-semibold transition-colors duration-150 ${
                period === item.id ? "bg-surface text-label shadow-card" : "text-label-secondary"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>
      {options.map((opt) => (
        <Stage
          key={opt.id}
          title={opt.title}
          lead={opt.lead}
          note={opt.note}
          period={period}
          blank={opt.id !== "sky" && opt.id !== "door"}
        >
          {opt.id === "front" && <FrontDoorOpen period={period} />}
          {opt.id === "sky" && <SkyOpen period={period} />}
          {opt.id === "door" && <DoorOpen period={period} />}
          {opt.id === "draw" && <DrawOpen period={period} />}
          {opt.id === "home" && <HomeOpen period={period} />}
          {opt.id === "heavens" && <HeavensOpen period={period} />}
        </Stage>
      ))}
    </div>
  );
}

function Stage({
  title,
  lead,
  note,
  period,
  blank,
  children,
}: {
  title: string;
  lead: string;
  note: string;
  period: Period;
  /** Starts from the background alone, the way the iOS launch image would have to look. */
  blank: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const [run, setRun] = useState(0);

  return (
    <figure className="flex w-full flex-col items-center gap-3">
      <figcaption className="w-full text-start">
        <h2 className="text-[20px] font-bold">{title}</h2>
        <p className="text-[14px] leading-relaxed text-label-secondary">{lead}</p>
        <p className="mt-1 text-[13px] font-medium text-label-tertiary">{note}</p>
      </figcaption>
      <div
        ref={ref}
        className="relative isolate h-[844px] w-[390px] shrink-0 overflow-hidden rounded-[40px] bg-bg text-label shadow-[0_20px_50px_-20px_rgb(40_30_20/0.35)] ring-1 ring-black/10"
      >
        {inView ? (
          <div key={`${run}-${period}`} className="absolute inset-0 isolate">
            {children}
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">{!blank && <HomieMark size={ICON} />}</div>
        )}
      </div>
      <button
        type="button"
        onClick={() => setRun((count) => count + 1)}
        className="flex min-h-11 items-center gap-2 rounded-full bg-surface px-5 text-[15px] font-semibold text-accent shadow-card ring-1 ring-hairline transition-transform duration-150 ease-out active:scale-[0.97]"
      >
        <RotateCcw aria-hidden size={16} strokeWidth={2.4} />
        לנגן שוב
      </button>
    </figure>
  );
}

/* ---------- the screen it opens into ---------- */

function rise(start: number | null, index: number) {
  if (start === null) return {};
  return {
    initial: { opacity: 0, transform: "translateY(10px)" },
    animate: { opacity: 1, transform: "translateY(0px)" },
    transition: { duration: 0.3, ease: easeOut, delay: start + index * 0.04 },
  };
}

function TodayContent({ period, start }: { period: Period; start: number | null }) {
  const rows = [
    { title: "לעשות כביסה לבנה", who: yana },
    { title: "אבק בסלון", who: yarden },
    { title: "לקנות מתנה לליאם", who: yarden },
  ];
  return (
    <div className="relative flex flex-col gap-6 px-5 pt-[70px]">
      <motion.div {...rise(start, 0)} className="flex items-center justify-between">
        <p className="text-[15px] font-medium text-label-secondary">יום שלישי, 3 בנובמבר</p>
        <span className="flex size-9 items-center justify-center rounded-full bg-surface/70 shadow-card ring-1 ring-hairline">
          <Bell aria-hidden size={17} strokeWidth={2.2} />
        </span>
      </motion.div>
      <motion.div {...rise(start, 1)}>
        <h1 className="text-[34px] font-bold leading-tight tracking-tight">{greetings[period]}</h1>
        <p className="mt-3 text-[20px] font-medium leading-[1.45] text-label/65">
          נשארו לכם <span className="font-bold text-label">4 משימות</span> להיום, ובשעה{" "}
          <span className="font-bold text-label">19:00</span> ירדן · חוג של ליאם.
        </p>
      </motion.div>
      <motion.div {...rise(start, 2)} className="flex gap-6">
        {[
          { member: yarden, text: "1 מתוך 2" },
          { member: yana, text: "0 מתוך 2" },
        ].map(({ member, text }) => (
          <div key={member.id} className="flex items-center gap-2.5">
            <Avatar member={member} size={44} />
            <div>
              <p className="text-[15px] font-semibold">{member.name}</p>
              <p className="text-[13px] text-label-secondary">{text}</p>
            </div>
          </div>
        ))}
      </motion.div>
      <motion.ul {...rise(start, 3)} className="overflow-hidden rounded-card bg-surface shadow-card ring-1 ring-hairline">
        {rows.map((row) => (
          <li key={row.title} className="flex min-h-[56px] items-center gap-3 border-b border-separator ps-4 pe-3.5 last:border-b-0">
            <span className="size-[24px] shrink-0 rounded-full border-2 border-label-tertiary" />
            <span className="flex-1 text-[17px]">{row.title}</span>
            <Avatar member={row.who} size={24} />
          </li>
        ))}
      </motion.ul>
    </div>
  );
}

/* ---------- א · the hour's sky ---------- */

function SkyOpen({ period }: { period: Period }) {
  const [lit, setLit] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setLit(true), 60);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <>
      <motion.div
        aria-hidden
        className="atmosphere"
        data-period={period}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, ease: easeOut, delay: 0.12 }}
      />
      <TodayContent period={period} start={0.4} />
      <motion.div
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        initial={{ opacity: 1, transform: "translateY(0px) scale(1)" }}
        animate={{ opacity: 0, transform: "translateY(-56px) scale(0.7)" }}
        transition={{ duration: 0.42, ease: easeOut, delay: 0.34 }}
      >
        <HomieMark size={ICON} lit={lit} />
      </motion.div>
    </>
  );
}

/* ---------- ב · a door ---------- */

function DoorOpen({ period }: { period: Period }) {
  return (
    <>
      <motion.div
        className="absolute inset-0 isolate"
        initial={{ opacity: 0, transform: "scale(0.94)" }}
        animate={{ opacity: 1, transform: "scale(1)" }}
        transition={{ duration: 0.45, ease: easeOut, delay: 0.42 }}
      >
        <div aria-hidden className="atmosphere" data-period={period} />
        <TodayContent period={period} start={null} />
      </motion.div>
      <motion.div
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.22, ease: "linear", delay: 0.5 }}
      >
        <motion.div
          className="relative"
          initial={{ transform: "scale(1)" }}
          animate={{ transform: "scale(13)" }}
          transition={{ duration: 0.5, ease: [0.55, 0, 0.8, 0.25], delay: 0.1 }}
        >
          <HomieMark size={ICON} />
          <motion.span
            aria-hidden
            className="absolute inset-0 bg-[#55806b]"
            style={{ borderRadius: ICON * 0.235 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.16, ease: "linear", delay: 0.2 }}
          />
        </motion.div>
      </motion.div>
    </>
  );
}

/* ---------- ג · drawn in one line ---------- */

function DrawOpen({ period }: { period: Period }) {
  return (
    <>
      <motion.div
        aria-hidden
        className="atmosphere"
        data-period={period}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, ease: easeOut, delay: 0.75 }}
      />
      <TodayContent period={period} start={0.84} />
      <motion.div
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        initial={{ opacity: 1, transform: "scale(1)" }}
        animate={{ opacity: 0, transform: "scale(0.9)" }}
        transition={{ duration: 0.25, ease: easeOut, delay: 0.8 }}
      >
        <svg viewBox="0 0 64 64" width={ICON * 1.3} height={ICON * 1.3} aria-hidden>
          <defs>
            <radialGradient id="draw-glow" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#ffd59a" stopOpacity="0.95" />
              <stop offset="1" stopColor="#ffd59a" stopOpacity="0" />
            </radialGradient>
          </defs>
          <motion.path
            d={HOUSE}
            fill="#e3ece6"
            stroke="#55806b"
            strokeWidth="2.2"
            strokeLinejoin="round"
            strokeLinecap="round"
            initial={{ pathLength: 0, fillOpacity: 0 }}
            animate={{ pathLength: 1, fillOpacity: 1 }}
            transition={{
              pathLength: { duration: 0.5, ease: [0.65, 0, 0.35, 1], delay: 0.05 },
              fillOpacity: { duration: 0.2, ease: "linear", delay: 0.45 },
            }}
          />
          <motion.circle
            cx="32"
            cy="36.5"
            r="13"
            fill="url(#draw-glow)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, ease: easeOut, delay: 0.55 }}
          />
          <motion.rect
            x="27"
            y="32"
            width="10"
            height="9"
            rx="2.4"
            fill="#f4b46a"
            style={{ transformOrigin: "32px 36.5px" }}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", bounce: 0.35, duration: 0.4, delay: 0.55 }}
          />
        </svg>
      </motion.div>
    </>
  );
}

/* ---------- shared pieces of the drawn scenes ---------- */

const SAGE = "#55806b";

/** Light that spills from one point of the scene until it fills the phone, then hands over to the sky. */
function Flood({ at, color, delay }: { at: { x: number; y: number }; color: string; delay: number }) {
  return (
    <div
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
      style={{ transform: `translate(${at.x}px, ${at.y}px)` }}
    >
      <motion.span
        className="size-10 shrink-0 rounded-full blur-md"
        initial={{ opacity: 0, transform: "scale(0.2)", backgroundColor: "#ffd59a" }}
        animate={{ opacity: [0, 1, 1, 0], transform: "scale(52)", backgroundColor: color }}
        transition={{
          duration: 0.95,
          ease: easeOut,
          delay,
          opacity: { duration: 0.95, times: [0, 0.12, 0.6, 1], ease: "linear", delay },
        }}
      />
    </div>
  );
}

/** The ground stretching out from the door, the house drawn in one line, the window lighting at `litAt`. */
function DrawnHouse({ start, litAt }: { start: number; litAt: number }) {
  return (
    <>
      <defs>
        <radialGradient id="scene-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffd59a" stopOpacity="0.95" />
          <stop offset="1" stopColor="#ffd59a" stopOpacity="0" />
        </radialGradient>
      </defs>
      {["M32 48H-14", "M32 48H78"].map((d) => (
        <motion.path
          key={d}
          d={d}
          fill="none"
          stroke={SAGE}
          strokeOpacity={0.4}
          strokeWidth={1.4}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.45, ease: easeOut, delay: start }}
        />
      ))}
      <motion.path
        d={HOUSE}
        fill="#e3ece6"
        stroke={SAGE}
        strokeWidth="2.2"
        strokeLinejoin="round"
        strokeLinecap="round"
        initial={{ pathLength: 0, fillOpacity: 0 }}
        animate={{ pathLength: 1, fillOpacity: 1 }}
        transition={{
          pathLength: { duration: 0.55, ease: [0.65, 0, 0.35, 1], delay: start + 0.12 },
          fillOpacity: { duration: 0.25, ease: "linear", delay: start + 0.55 },
        }}
      />
      <motion.rect
        x="27"
        y="32"
        width="10"
        height="9"
        rx="2.4"
        fill="#cfe0d5"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, delay: start + 0.6 }}
      />
      <motion.circle
        cx="32"
        cy="36.5"
        r="14"
        fill="url(#scene-glow)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, ease: easeOut, delay: litAt }}
      />
      <motion.rect
        x="27"
        y="32"
        width="10"
        height="9"
        rx="2.4"
        fill="#f4b46a"
        style={{ transformOrigin: "32px 36.5px" }}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", bounce: 0.4, duration: 0.4, delay: litAt }}
      />
    </>
  );
}

/** The drawn scene leaves upward as the screen behind it arrives. */
function Scene({ leaveAt, children }: { leaveAt: number; children: React.ReactNode }) {
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
      initial={{ opacity: 1, transform: "translateY(0px) scale(1)" }}
      animate={{ opacity: 0, transform: "translateY(-36px) scale(0.92)" }}
      transition={{ duration: 0.38, ease: easeOut, delay: leaveAt }}
    >
      <svg viewBox="-16 0 96 64" width={SCENE_W} height={SCENE_H} aria-hidden className="overflow-visible">
        {children}
      </svg>
    </motion.div>
  );
}

function Sky({ period, delay }: { period: Period; delay: number }) {
  return (
    <motion.div
      aria-hidden
      className="atmosphere"
      data-period={period}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.55, ease: easeOut, delay }}
    />
  );
}

/* ---------- ד · coming home ---------- */

function Walker({ from, to, color }: { from: number; to: number; color: string }) {
  return (
    <motion.circle
      style={{ fill: color }}
      initial={{ cx: from, cy: 45, r: 2.6, opacity: 0 }}
      animate={{ cx: to, cy: [45, 43.6, 45, 43.6, 45], r: [2.6, 2.6, 0], opacity: 1 }}
      transition={{
        cx: { duration: 0.65, ease: easeOut, delay: 0.32 },
        cy: { duration: 0.65, ease: "easeInOut", delay: 0.32 },
        r: { duration: 0.85, times: [0, 0.78, 1], ease: "easeIn", delay: 0.32 },
        opacity: { duration: 0.15, delay: 0.32 },
      }}
    />
  );
}

function HomeOpen({ period }: { period: Period }) {
  return (
    <>
      <Sky period={period} delay={1.25} />
      <TodayContent period={period} start={1.38} />
      <Scene leaveAt={1.2}>
        <DrawnHouse start={0.05} litAt={1.0} />
        <Walker from={-14} to={29.5} color="var(--indigo)" />
        <Walker from={78} to={34.5} color="var(--pink)" />
      </Scene>
      <Flood at={toScreen(32, 36.5)} color={glows[period]} delay={1.06} />
    </>
  );
}

/* ---------- ה · the sky draws itself ---------- */

const SUN = "#e7a24f";

function Rays({ cx, cy, delay, spin }: { cx: number; cy: number; delay: number; spin: boolean }) {
  return (
    <motion.g
      style={{ transformOrigin: `${cx}px ${cy}px` }}
      initial={{ opacity: 0, scale: 0.6, rotate: 0 }}
      animate={{ opacity: 1, scale: 1, rotate: spin ? 30 : 0 }}
      transition={{
        opacity: { duration: 0.2, delay },
        scale: { type: "spring", bounce: 0.4, duration: 0.45, delay },
        rotate: { duration: 1.2, ease: "linear", delay },
      }}
    >
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4;
        return (
          <line
            key={i}
            x1={cx + Math.cos(a) * 8}
            y1={cy + Math.sin(a) * 8}
            x2={cx + Math.cos(a) * 10.5}
            y2={cy + Math.sin(a) * 10.5}
            stroke={SUN}
            strokeWidth={1.6}
            strokeLinecap="round"
          />
        );
      })}
    </motion.g>
  );
}

const skyAt: Record<Period, { x: number; y: number }> = {
  morning: { x: 2, y: 16 },
  afternoon: { x: 6, y: 9 },
  evening: { x: 0, y: 40 },
  night: { x: 2, y: 13 },
};

function HeavenBody({ period }: { period: Period }) {
  const end = skyAt[period];
  if (period === "night") {
    const stars = [
      { x: 58, y: 7, d: 0.62 },
      { x: 70, y: 18, d: 0.7 },
      { x: 48, y: 2, d: 0.78 },
      { x: -10, y: 28, d: 0.86 },
      { x: 76, y: 4, d: 0.92 },
    ];
    return (
      <>
        <motion.path
          d={`M${end.x + 2} ${end.y - 6.5}a6.5 6.5 0 1 0 5.5 10a5 5 0 0 1 -5.5 -10Z`}
          fill="#e9ecf8"
          stroke="#7d86b8"
          strokeWidth={1.6}
          strokeLinejoin="round"
          initial={{ pathLength: 0, fillOpacity: 0 }}
          animate={{ pathLength: 1, fillOpacity: 1 }}
          transition={{
            pathLength: { duration: 0.5, ease: [0.65, 0, 0.35, 1], delay: 0.35 },
            fillOpacity: { duration: 0.25, delay: 0.75 },
          }}
        />
        {stars.map((star) => (
          <motion.circle
            key={`${star.x}-${star.y}`}
            cx={star.x}
            cy={star.y}
            fill="#9aa3d4"
            style={{ transformOrigin: `${star.x}px ${star.y}px` }}
            initial={{ r: 0, opacity: 0 }}
            animate={{ r: [0, 1.4, 0.9], opacity: [0, 1, 0.8] }}
            transition={{ duration: 0.4, ease: easeOut, delay: star.d }}
          />
        ))}
      </>
    );
  }
  if (period === "evening") {
    return (
      <>
        <defs>
          <clipPath id="above-ground">
            <rect x="-20" y="-10" width="110" height="58" />
          </clipPath>
        </defs>
        <g clipPath="url(#above-ground)">
          <motion.circle
            cx={end.x}
            r={7}
            fill="#f0a070"
            fillOpacity={0.9}
            initial={{ cy: 24, opacity: 0 }}
            animate={{ cy: end.y + 4, opacity: 1 }}
            transition={{ cy: { duration: 0.8, ease: easeOut, delay: 0.3 }, opacity: { duration: 0.3, delay: 0.3 } }}
          />
        </g>
        {[30, 36].map((y, i) => (
          <motion.path
            key={y}
            d={`M-14 ${y}H${i ? 8 : 14}`}
            stroke="#f0a070"
            strokeOpacity={0.5}
            strokeWidth={1.2}
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.4, ease: easeOut, delay: 0.55 + i * 0.08 }}
          />
        ))}
      </>
    );
  }
  const rising = period === "morning";
  return (
    <motion.g
      initial={{ y: rising ? 26 : 0 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.75, ease: easeOut, delay: 0.3 }}
    >
      <motion.circle
        cx={end.x}
        cy={end.y}
        r={5.5}
        fill="#fbe0b4"
        stroke={SUN}
        strokeWidth={1.8}
        initial={{ pathLength: 0, fillOpacity: 0 }}
        animate={{ pathLength: 1, fillOpacity: 1 }}
        transition={{
          pathLength: { duration: 0.45, ease: [0.65, 0, 0.35, 1], delay: 0.3 },
          fillOpacity: { duration: 0.25, delay: 0.65 },
        }}
      />
      <Rays cx={end.x} cy={end.y} delay={0.8} spin={!rising} />
    </motion.g>
  );
}

function HeavensOpen({ period }: { period: Period }) {
  const at = skyAt[period];
  return (
    <>
      <Sky period={period} delay={1.2} />
      <TodayContent period={period} start={1.34} />
      <Scene leaveAt={1.18}>
        <DrawnHouse start={0} litAt={0.95} />
        <HeavenBody period={period} />
      </Scene>
      <Flood at={toScreen(at.x, at.y)} color={glows[period]} delay={1.02} />
    </>
  );
}
