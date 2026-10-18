"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Plus } from "lucide-react";
import { useI18n } from "@/i18n/dictionary-provider";
import { useAddSheet, useSelectedDay } from "@/lib/household-store";
import { spring } from "@/lib/motion";
import { addKindFor, isActive, navItems } from "./nav-items";

export function Sidebar() {
  const pathname = usePathname();
  const { locale, dict } = useI18n();
  const show = useAddSheet((s) => s.show);
  const selectedDay = useSelectedDay((s) => s.day);

  return (
    <nav
      aria-label={dict.nav.main}
      className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 border-e border-separator px-4 py-8 md:flex"
    >
      <span className="px-3 text-2xl font-bold tracking-tight">Homie</span>
      <button
        type="button"
        onClick={() => show(addKindFor(pathname, locale), selectedDay)}
        aria-haspopup="dialog"
        className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-3 text-[15px] font-semibold text-accent-contrast transition-[scale,filter] duration-150 ease-out hover:brightness-110 active:scale-[0.97]"
      >
        <Plus aria-hidden size={18} strokeWidth={2.5} />
        {dict.add.open}
      </button>
      <ul className="flex flex-col gap-1">
        {navItems.map(({ key, path, icon: Icon }) => {
          const active = isActive(pathname, locale, path);
          return (
            <li key={key}>
              <Link
                href={`/${locale}${path}`}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors duration-200 ${
                  active ? "text-accent" : "text-label hover:bg-fill"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="sidebar-active"
                    transition={spring.snappy}
                    className="absolute inset-0 -z-10 rounded-xl bg-surface shadow-card"
                  />
                )}
                <Icon aria-hidden size={20} strokeWidth={active ? 2.25 : 1.75} />
                {dict.nav[key]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
