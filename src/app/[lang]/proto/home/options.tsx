"use client";

import {
  BatteryFull,
  Bell,
  CalendarDays,
  ChevronRight,
  Clock,
  House,
  ListChecks,
  Plus,
  Settings,
  ShoppingBasket,
  Signal,
  Sun,
  Wifi,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { ProgressRing } from "@/components/ui/progress-ring";
import type { Member } from "@/lib/tasks";

const yarden: Member = { id: "y", name: "ירדן", color: "var(--indigo)", photo: "/proto/yarden.jpg" };
const yana: Member = { id: "n", name: "יאנה", color: "var(--pink)", photo: null };

const today = [
  { title: "לעשות כביסה לבנה", who: yana },
  { title: "לתלות כביסה לבנה", who: yana },
  { title: "לסדר את הבגדים להחזיר לשיין", who: yana },
  { title: "אבק בסלון", who: yarden },
];
const overdue = [
  { title: "לדבר עם הקבלן לגבי ריח רטיבות בחדר שינה", who: yarden, when: "אתמול" },
  { title: "לקפל כביסה שחורה", who: yana, when: "אתמול" },
  { title: "לפנות מדיח", who: yarden, when: "לפני 3 ימים" },
];

const options = [
  { id: "a", title: "א · טבעות", lead: "כמו Apple Fitness — כמה עשיתם היום" },
  { id: "b", title: "ב · אריחים", lead: "כמו Reminders — מספרים ואז רשימות" },
  { id: "c", title: "ג · ווידג׳טים", lead: "הכל במסך אחד, בלי רשימה ארוכה" },
  { id: "d", title: "ד · משפט", lead: "משפט שמסכם את היום, ואז מה שקורה" },
] as const;

export function HomeOptions() {
  return (
    <div className="mx-auto flex w-full max-w-[430px] flex-col items-center gap-10 bg-bg px-4 py-10">
      <header className="w-full text-start">
        <p className="text-[13px] font-semibold text-label-secondary">בחירת כיוון</p>
        <h1 className="mt-1 text-[28px] font-bold tracking-[-0.02em]">מסך הבית</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-label-secondary">ארבעה כיוונים. גלול ובחר אחד, או שלב ביניהם.</p>
      </header>
      {options.map((opt) => (
        <figure key={opt.id} className="flex w-full flex-col items-center gap-3">
          <figcaption className="w-full text-start">
            <h2 className="text-[20px] font-bold">{opt.title}</h2>
            <p className="text-[14px] text-label-secondary">{opt.lead}</p>
          </figcaption>
          <div className="overflow-hidden rounded-[40px] ring-1 ring-black/10 shadow-[0_20px_50px_-20px_rgb(40_30_20/0.35)]">
            {opt.id === "a" && <OptionSummary />}
            {opt.id === "b" && <OptionReminders />}
            {opt.id === "c" && <OptionWidgets />}
            {opt.id === "d" && <OptionStory />}
          </div>
        </figure>
      ))}
    </div>
  );
}

/* ---------- shared chrome ---------- */

function Phone({ id, children, tint }: { id: string; children: React.ReactNode; tint?: React.ReactNode }) {
  return (
    <section id={id} className="relative h-[844px] w-[390px] shrink-0 overflow-hidden bg-bg text-label">
      {tint}
      <div dir="ltr" className="absolute inset-x-0 top-0 z-30 flex h-[54px] items-center justify-between px-8 pt-2 text-[16px] font-semibold">
        <span>14:39</span>
        <span className="flex items-center gap-1.5">
          <Signal size={16} strokeWidth={2.5} />
          <Wifi size={16} strokeWidth={2.5} />
          <BatteryFull size={22} strokeWidth={2} />
        </span>
      </div>
      <div className="relative z-10 px-5 pt-[58px]">{children}</div>
      <TabBar />
      <span className="absolute bottom-2 left-1/2 z-40 h-[5px] w-[134px] -translate-x-1/2 rounded-full bg-label" />
    </section>
  );
}

function TabBar() {
  const tabs = [
    { icon: House, label: "היום", active: true },
    { icon: ListChecks, label: "משימות" },
    { icon: ShoppingBasket, label: "קניות" },
    { icon: CalendarDays, label: "יומן" },
    { icon: Settings, label: "הבית" },
  ];
  return (
    <div className="absolute inset-x-4 bottom-[26px] z-30 flex items-center gap-3">
      <nav className="material grid h-[62px] flex-1 grid-cols-5 rounded-full p-1 shadow-[0_10px_30px_-8px_rgb(40_30_20/0.25)] ring-1 ring-black/[0.06]">
        {tabs.map(({ icon: Icon, label, active }) => (
          <span
            key={label}
            className={`flex flex-col items-center justify-center gap-0.5 rounded-full text-[10px] font-semibold ${
              active ? "bg-[color-mix(in_oklab,var(--label)_7%,transparent)] text-accent" : "text-label"
            }`}
          >
            <Icon size={21} strokeWidth={active ? 2.3 : 1.9} />
            {label}
          </span>
        ))}
      </nav>
      <span className="flex size-[62px] items-center justify-center rounded-full bg-accent text-accent-contrast shadow-[0_10px_24px_-8px_color-mix(in_oklab,var(--accent)_80%,transparent)]">
        <Plus size={26} strokeWidth={2.4} />
      </span>
    </div>
  );
}

function Circle({ color = "var(--label-tertiary)", size = 22 }: { color?: string; size?: number }) {
  return <span className="shrink-0 rounded-full border-[1.75px]" style={{ width: size, height: size, borderColor: color }} />;
}

function Faces({ size = 32 }: { size?: number }) {
  return (
    <span className="flex items-center">
      <span className="rounded-full ring-2 ring-bg">
        <Avatar member={yarden} size={size} />
      </span>
      <span className="-ms-2.5 rounded-full ring-2 ring-bg">
        <Avatar member={yana} size={size} />
      </span>
    </span>
  );
}

function Chevron({ className = "" }: { className?: string }) {
  return <ChevronRight size={18} strokeWidth={2.25} className={`shrink-0 rtl:-scale-x-100 ${className}`} />;
}

const card = "rounded-[22px] bg-surface shadow-card";

/* ---------- A · Summary: Fitness-style rings ---------- */

function DoubleRing({ size = 116 }: { size?: number }) {
  const stroke = 13;
  const rings = [
    { r: size / 2 - stroke / 2 - 1, value: 0.5, color: "var(--indigo)" },
    { r: size / 2 - stroke * 1.5 - 3, value: 0.4, color: "var(--pink)" },
  ];
  return (
    <svg width={size} height={size} className="-rotate-90 shrink-0">
      {rings.map(({ r, value, color }) => {
        const c = 2 * Math.PI * r;
        return (
          <g key={r}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} stroke={`color-mix(in oklab, ${color} 18%, transparent)`} />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              strokeWidth={stroke}
              stroke={color}
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - value)}
            />
          </g>
        );
      })}
    </svg>
  );
}

function OptionSummary() {
  return (
    <Phone id="a">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold text-label-secondary">יום חמישי, 22 באוקטובר</p>
        <span className="flex size-9 items-center justify-center rounded-full bg-surface shadow-card">
          <Bell size={18} strokeWidth={2} />
        </span>
      </div>
      <h1 className="-mt-1 text-[34px] font-bold leading-[1.15] tracking-[-0.02em]">היום</h1>

      <div className={`${card} mt-4 p-5`}>
        <div className="flex items-baseline justify-between">
          <p className="text-[17px] font-semibold">ההתקדמות של הבית</p>
          <p className="text-[15px] text-label-secondary tabular-nums">3 מתוך 7</p>
        </div>
        <div className="mt-4 flex items-center gap-6">
          <DoubleRing />
          <div className="flex flex-col gap-3">
            {[
              { m: yarden, done: 1, total: 2 },
              { m: yana, done: 2, total: 5 },
            ].map(({ m, done, total }) => (
              <div key={m.id}>
                <p className="text-[14px] font-semibold" style={{ color: m.color }}>
                  {m.name}
                </p>
                <p dir="ltr" className="text-end text-[28px] font-bold leading-none tabular-nums">
                  {done}
                  <span className="text-[20px] font-semibold text-label-tertiary">/{total}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={`${card} mt-3 flex items-center gap-3 p-4`}>
        <span className="w-1 self-stretch rounded-full bg-pink" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-pink">17:30 · בעוד 3 שעות</p>
          <p className="text-[17px] font-semibold leading-snug">רופאת שיניים</p>
          <p className="text-[14px] text-label-secondary">יאנה · מרפאת שן־טוב</p>
        </div>
        <Avatar member={yana} size={34} />
      </div>

      <div className="mt-6 flex items-center justify-between px-1">
        <h2 className="text-[22px] font-bold tracking-[-0.01em]">משימות להיום</h2>
        <span className="flex items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--orange)_13%,transparent)] px-3 py-1 text-[13px] font-semibold text-orange">
          <Clock size={13} strokeWidth={2.5} />
          15 באיחור
        </span>
      </div>
      <div className={`${card} mt-2 overflow-hidden`}>
        {today.map((task, i) => (
          <div key={task.title} className="flex min-h-[52px] items-center gap-3 ps-4">
            <Circle />
            <div className={`flex min-h-[52px] flex-1 items-center gap-3 pe-4 ${i < today.length - 1 ? "border-b border-separator" : ""}`}>
              <span className="flex-1 text-[17px]">{task.title}</span>
              <Avatar member={task.who} size={24} />
            </div>
          </div>
        ))}
      </div>
    </Phone>
  );
}

/* ---------- B · Reminders: smart tiles + plain lists ---------- */

function Tile({ icon: Icon, color, count, label }: { icon: typeof Sun; color: string; count: number; label: string }) {
  return (
    <div className="flex h-[84px] flex-col justify-between rounded-[14px] bg-surface p-3 shadow-card">
      <div className="flex items-start justify-between">
        <span className="flex size-[32px] items-center justify-center rounded-full text-white" style={{ background: color }}>
          <Icon size={17} strokeWidth={2.4} />
        </span>
        <span className="text-[28px] font-bold leading-none tabular-nums">{count}</span>
      </div>
      <span className="text-[15px] font-semibold text-label-secondary">{label}</span>
    </div>
  );
}

function OptionReminders() {
  return (
    <Phone id="b">
      <div className="flex items-center justify-end gap-2">
        <Faces size={30} />
        <span className="flex size-9 items-center justify-center rounded-full bg-surface shadow-card">
          <Bell size={18} strokeWidth={2} />
        </span>
      </div>
      <h1 className="mt-1 text-[32px] font-bold leading-[1.1] tracking-[-0.02em]">צהריים טובים, ירדן</h1>
      <p className="mt-0.5 text-[15px] text-label-secondary">יום חמישי, 22 באוקטובר · משפחת סמוראי</p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Tile icon={Sun} color="var(--accent)" count={4} label="היום" />
        <Tile icon={Clock} color="var(--orange)" count={15} label="באיחור" />
        <Tile icon={ShoppingBasket} color="var(--teal)" count={6} label="לקנות" />
        <Tile icon={CalendarDays} color="var(--pink)" count={1} label="ביומן היום" />
      </div>

      <h2 className="mt-7 px-1 text-[22px] font-bold text-accent">להיום</h2>
      <div className="mt-1">
        {today.map((task) => (
          <div key={task.title} className="flex items-center gap-3 ps-1">
            <Circle color="var(--accent)" />
            <div className="flex min-h-[54px] flex-1 items-center gap-3 border-b border-separator py-2 pe-1">
              <div className="min-w-0 flex-1">
                <p className="text-[17px] leading-snug">{task.title}</p>
                <p className="text-[13px] text-label-secondary">{task.who.name}</p>
              </div>
              <Avatar member={task.who} size={22} />
            </div>
          </div>
        ))}
      </div>

      <h2 className="mt-6 px-1 text-[22px] font-bold text-orange">באיחור</h2>
      <div className="mt-1">
        {overdue.slice(0, 2).map((task) => (
          <div key={task.title} className="flex items-center gap-3 ps-1">
            <Circle color="var(--orange)" />
            <div className="flex min-h-[54px] flex-1 items-center gap-3 border-b border-separator py-2 pe-1">
              <div className="min-w-0 flex-1">
                <p className="text-[17px] leading-snug">{task.title}</p>
                <p className="text-[13px] text-orange">{task.when}</p>
              </div>
              <Avatar member={task.who} size={22} />
            </div>
          </div>
        ))}
      </div>
    </Phone>
  );
}

/* ---------- C · Widgets: the day as iOS widgets ---------- */

function OptionWidgets() {
  return (
    <Phone id="c">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[13px] font-semibold text-label-secondary">יום חמישי, 22 באוקטובר</p>
          <h1 className="text-[30px] font-bold leading-[1.15] tracking-[-0.02em]">צהריים טובים, ירדן</h1>
        </div>
        <Faces size={34} />
      </div>

      <div className={`${card} mt-5 flex gap-4 p-4`}>
        <ProgressRing value={3 / 7} size={104} stroke={11}>
          <span className="flex flex-col items-center leading-none">
            <span dir="ltr" className="text-[26px] font-bold tabular-nums">
              3<span className="text-[18px] text-label-tertiary">/7</span>
            </span>
            <span className="mt-1 text-[11px] font-semibold text-label-secondary">בוצעו</span>
          </span>
        </ProgressRing>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-accent">היום · 4 נשארו</p>
          <div className="mt-2 flex flex-col gap-2">
            {today.slice(0, 3).map((task) => (
              <div key={task.title} className="flex items-center gap-2">
                <Circle size={16} />
                <span className="min-w-0 flex-1 truncate text-[15px]">{task.title}</span>
                <Avatar member={task.who} size={18} />
              </div>
            ))}
          </div>
          <p className="mt-2 text-[13px] text-label-tertiary">ועוד אחת</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className={`${card} flex aspect-square flex-col p-4`}>
          <p className="text-[13px] font-bold text-red">חמישי</p>
          <p className="text-[38px] font-light leading-none tabular-nums">22</p>
          <div className="mt-auto flex gap-2">
            <span className="w-1 rounded-full bg-pink" />
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold">רופאת שיניים</p>
              <p className="text-[13px] text-label-secondary">17:30 · יאנה</p>
            </div>
          </div>
          <p className="mt-2 truncate text-[12px] text-label-tertiary">מחר: ארוחת שישי</p>
        </div>
        <div className={`${card} flex aspect-square flex-col p-4`}>
          <span className="flex size-[32px] items-center justify-center rounded-full bg-teal text-white">
            <ShoppingBasket size={17} strokeWidth={2.4} />
          </span>
          <p className="mt-auto text-[34px] font-bold leading-none tabular-nums">6</p>
          <p className="text-[14px] font-semibold text-label-secondary">פריטים לקנות</p>
          <p className="mt-1 truncate text-[13px] text-label-tertiary">חלב · ביצים · לחם</p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3 rounded-[22px] bg-[color-mix(in_oklab,var(--orange)_11%,var(--surface))] p-4">
        <span className="flex size-[38px] shrink-0 items-center justify-center rounded-full bg-orange text-white">
          <Clock size={19} strokeWidth={2.4} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-semibold">15 משימות מחכות</p>
          <p className="truncate text-[13px] text-label-secondary">הכי ישנה: לפנות מדיח</p>
        </div>
        <Chevron className="text-label-tertiary" />
      </div>
    </Phone>
  );
}

/* ---------- D · Story: the day told in a sentence ---------- */

function OptionStory() {
  return (
    <Phone
      id="d"
      tint={
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-[470px]"
          style={{
            background:
              "radial-gradient(120% 70% at 85% 0%, color-mix(in oklab, #f2c9a0 70%, transparent), transparent 60%), radial-gradient(110% 80% at 10% 10%, #c9dfe9, transparent 65%), linear-gradient(180deg, #dfe9ec, var(--bg))",
          }}
        />
      }
    >
      <div className="flex items-center justify-between pt-2">
        <p className="text-[14px] font-semibold text-label/60">יום חמישי, 22 באוקטובר</p>
        <span className="flex size-9 items-center justify-center rounded-full bg-white/55 backdrop-blur-xl">
          <Bell size={18} strokeWidth={2} />
        </span>
      </div>
      <h1 className="mt-1 text-[36px] font-bold leading-[1.08] tracking-[-0.025em]">צהריים טובים, ירדן</h1>
      <p className="mt-3 text-[20px] font-medium leading-[1.45] text-label/65 text-pretty">
        נשארו לכם <span className="font-bold text-label">4 משימות</span> להיום, ובשעה{" "}
        <span className="font-bold text-label">17:30</span> יאנה ברופאת שיניים.
      </p>

      <div className="mt-5 flex gap-5">
        {[
          { m: yarden, value: 0.5, text: "1 מתוך 2" },
          { m: yana, value: 0.4, text: "2 מתוך 5" },
        ].map(({ m, value, text }) => (
          <div key={m.id} className="flex items-center gap-2.5">
            <ProgressRing value={value} size={50} stroke={3.5} color={m.color}>
              <Avatar member={m} size={40} />
            </ProgressRing>
            <div className="leading-tight">
              <p className="text-[15px] font-semibold">{m.name}</p>
              <p className="text-[13px] text-label/60 tabular-nums">{text}</p>
            </div>
          </div>
        ))}
      </div>

      <h2 className="mt-8 px-1 text-[20px] font-bold">בהמשך היום</h2>
      <div className="-me-5 mt-2 flex gap-3 overflow-hidden">
        <div className={`${card} w-[220px] shrink-0 p-4`}>
          <span className="rounded-full bg-[color-mix(in_oklab,var(--pink)_14%,transparent)] px-2.5 py-0.5 text-[13px] font-semibold text-pink">
            17:30
          </span>
          <p className="mt-2.5 text-[17px] font-semibold leading-snug">רופאת שיניים</p>
          <p className="text-[14px] text-label-secondary">יאנה · מרפאת שן־טוב</p>
        </div>
        <div className={`${card} w-[220px] shrink-0 p-4`}>
          <span className="rounded-full bg-fill px-2.5 py-0.5 text-[13px] font-semibold text-accent">שלך</span>
          <p className="mt-2.5 text-[17px] font-semibold leading-snug">אבק בסלון</p>
          <p className="text-[14px] text-label-secondary">משימה להיום</p>
        </div>
      </div>

      <div className={`${card} mt-4 overflow-hidden`}>
        {today.slice(0, 3).map((task, i) => (
          <div key={task.title} className="flex min-h-[52px] items-center gap-3 ps-4">
            <Circle />
            <div className={`flex min-h-[52px] flex-1 items-center gap-3 pe-4 ${i < 2 ? "border-b border-separator" : ""}`}>
              <span className="flex-1 text-[17px]">{task.title}</span>
              <Avatar member={task.who} size={24} />
            </div>
          </div>
        ))}
      </div>

      <div className={`${card} mt-3 flex items-center gap-3 p-4`}>
        <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-orange text-white">
          <Clock size={16} strokeWidth={2.5} />
        </span>
        <span className="flex-1 text-[16px] font-medium">15 משימות מחכות מימים קודמים</span>
        <Chevron className="text-label-tertiary" />
      </div>
    </Phone>
  );
}
