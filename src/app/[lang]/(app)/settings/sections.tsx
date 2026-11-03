"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CalendarSync, ChevronLeft, House, LifeBuoy, Palette, ShieldCheck, UserRound, type LucideIcon } from "lucide-react";
import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
import { useAuth } from "@/lib/auth/session";
import { useHousehold } from "@/lib/household-store";
import { isCustomized } from "@/lib/look";
import { usePrefsOf } from "@/lib/prefs-store";
import { useLook } from "@/lib/theme";

export const settingsSections = ["profile", "house", "appearance", "notifications", "calendars", "account", "help"] as const;
export type SettingsSection = (typeof settingsSections)[number];

const icons: Record<SettingsSection, { icon: LucideIcon; tile: string }> = {
  profile: { icon: UserRound, tile: "bg-indigo" },
  house: { icon: House, tile: "bg-[var(--green)]" },
  appearance: { icon: Palette, tile: "bg-pink" },
  notifications: { icon: Bell, tile: "bg-[var(--red)]" },
  calendars: { icon: CalendarSync, tile: "bg-teal" },
  account: { icon: ShieldCheck, tile: "bg-[var(--purple)]" },
  help: { icon: LifeBuoy, tile: "bg-[var(--brown)]" },
};

/** A name typed by someone, kept in its own direction inside the line (a Latin name in a Hebrew sentence). */
const isolate = (text: string) => `\u2068${text}\u2069`;

/** One line under each section saying how it's set now. */
function useSummary(section: SettingsSection) {
  const { locale, dict } = useI18n();
  const copy = dict.settingsNav.summary;
  const session = useAuth((s) => s.session);
  const count = useHousehold((s) => s.members.length);
  const look = useLook();
  const routine = usePrefsOf(session?.userId, (prefs) => ({ morning: prefs.morning, quiet: prefs.quiet, delivery: prefs.delivery }));
  switch (section) {
    case "profile":
      return format(copy.profile, { name: isolate(session?.displayName ?? ""), language: dict.settings.languageNames[locale] });
    case "house": {
      const name = isolate(session?.householdName || dict.settings.household);
      return count > 1 ? format(copy.house, { name, count: String(count) }) : format(copy.houseOne, { name });
    }
    case "appearance":
      return format(isCustomized(look) ? copy.appearanceCustom : copy.appearance, {
        mode: dict.look.modes[look.mode],
        theme: dict.look.themes[look.theme],
      });
    case "notifications":
      return [
        routine.morning.on ? format(copy.morningOn, { time: routine.morning.time }) : copy.morningOff,
        routine.quiet.on ? format(copy.quietOn, { start: routine.quiet.start, end: routine.quiet.end }) : null,
        routine.delivery === "digest" ? copy.digest : null,
      ]
        .filter(Boolean)
        .join(" · ");
    default:
      return copy[section];
  }
}

function SectionIcon({ section, size = "size-[30px]" }: { section: SettingsSection; size?: string }) {
  const { icon: Icon, tile } = icons[section];
  return (
    <span aria-hidden className={`flex ${size} shrink-0 items-center justify-center rounded-[8px] text-white ${tile}`}>
      <Icon size={18} strokeWidth={2} />
    </span>
  );
}

const hrefOf = (locale: string, section: SettingsSection) => `/${locale}/settings/${section}`;

function ListRow({ section }: { section: SettingsSection }) {
  const { locale, dict } = useI18n();
  const summary = useSummary(section);
  return (
    <li>
      <Link href={hrefOf(locale, section)} className="flex min-h-[60px] items-center gap-3 px-4 py-row active:bg-fill">
        <SectionIcon section={section} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[17px] leading-snug">{dict.settingsNav.sections[section]}</span>
          {summary && <span className="truncate text-[14px] leading-snug text-label-secondary">{summary}</span>}
        </span>
        <ChevronLeft aria-hidden size={18} className="shrink-0 text-label-tertiary ltr:-scale-x-100" />
      </Link>
    </li>
  );
}

/** The phone's settings: one grouped list, each section opening its own screen. */
export function SettingsList() {
  const groups: SettingsSection[][] = [
    ["profile", "house"],
    ["appearance", "notifications", "calendars"],
    ["account", "help"],
  ];
  return (
    <div className="flex flex-col gap-stack">
      {groups.map((group) => (
        <ul key={group.join()} className="divide-y divide-separator overflow-hidden rounded-card bg-surface shadow-card">
          {group.map((section) => (
            <ListRow key={section} section={section} />
          ))}
        </ul>
      ))}
    </div>
  );
}

export function useCurrentSection(): SettingsSection | null {
  const pathname = usePathname();
  const match = pathname.match(/\/settings\/([a-z-]+)/)?.[1];
  return settingsSections.includes(match as SettingsSection) ? (match as SettingsSection) : null;
}

/** On a wide screen the sections stay beside the content, like the sidebar of a Mac settings window. */
export function SettingsNav() {
  const { locale, dict } = useI18n();
  const current = useCurrentSection() ?? "profile";
  return (
    <nav aria-label={dict.settingsNav.title} className="sticky top-10 hidden self-start lg:block">
      <p className="px-3 pb-3 text-[28px] font-bold tracking-tight">{dict.settingsNav.title}</p>
      <ul className="flex flex-col gap-0.5">
        {settingsSections.map((section) => {
          const active = section === current;
          return (
            <li key={section}>
              <Link
                href={hrefOf(locale, section)}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-[10px] px-3 py-1.5 text-[15px] leading-snug transition-colors duration-150 ease-out ${
                  active ? "bg-surface font-semibold shadow-card" : "text-label hover:bg-fill"
                }`}
              >
                <SectionIcon section={section} size="size-7" />
                <span className="min-w-0">{dict.settingsNav.sections[section]}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** A section's screen: a way back on the phone, its title, and what it's for. */
export function SectionHeader({ section }: { section: SettingsSection }) {
  const { locale, dict } = useI18n();
  return (
    <div className="flex flex-col gap-1 pb-6 pt-4 lg:pt-10">
      <Link
        href={`/${locale}/settings`}
        className="-ms-2 flex min-h-11 items-center gap-0.5 self-start pe-2 text-[17px] text-accent active:opacity-60 lg:hidden"
      >
        <ChevronLeft aria-hidden size={22} className="rtl:-scale-x-100" />
        {dict.settingsNav.back}
      </Link>
      <h1 className="text-balance text-[34px] font-bold leading-tight tracking-tight">{dict.settingsNav.sections[section]}</h1>
      <p className="text-[15px] leading-snug text-label-secondary">{dict.settingsNav.leads[section]}</p>
    </div>
  );
}
