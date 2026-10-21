"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Plus } from "lucide-react";
import { useI18n } from "@/i18n/dictionary-provider";
import { useAddSheet, useSelectedDay } from "@/lib/household-store";
import { spring } from "@/lib/motion";
import { addKindFor, isActive, navItems } from "./nav-items";

/** iOS 26-style floating glass tab bar, with the add action as its own round button. */
export function TabBar() {
  const pathname = usePathname();
  const { locale, dict } = useI18n();
  const show = useAddSheet((s) => s.show);
  const selectedDay = useSelectedDay((s) => s.day);

  return (
    <div className="keyboard-hides pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(env(safe-area-inset-bottom),10px)] md:hidden">
      <div className="relative mx-auto max-w-lg">
        <button
          type="button"
          onClick={() => show(addKindFor(pathname, locale), selectedDay)}
          aria-label={dict.add.open}
          aria-haspopup="dialog"
          className="pointer-events-auto absolute inset-x-0 top-0 z-10 mx-auto flex size-14 -translate-y-1/2 items-center justify-center rounded-full bg-accent text-accent-contrast shadow-[0_10px_24px_color-mix(in_oklab,var(--accent)_38%,transparent),inset_0_1px_0_rgb(255_255_255/0.32)] ring-[3px] ring-surface transition-transform duration-150 ease-out active:scale-95"
        >
          <Plus aria-hidden size={26} strokeWidth={2.5} />
        </button>
        <nav
          aria-label={dict.nav.main}
          className="pointer-events-auto rounded-[28px] bg-surface px-1 pb-1 pt-8 shadow-[0_10px_30px_rgb(37_79_65/0.1)]"
        >
          <ul className="flex">
            {navItems
              .filter((item) => item.inTabBar)
              .map(({ key, path, icon: Icon }) => {
                const active = isActive(pathname, locale, path);
                return (
                  <li key={key} className="flex-1">
                    <Link
                      href={`/${locale}${path}`}
                      aria-current={active ? "page" : undefined}
                      className={`relative flex h-12 flex-col items-center justify-center gap-0.5 rounded-2xl text-[10px] font-semibold transition-[color,scale] duration-150 ease-out active:scale-95 ${
                        active ? "text-accent" : "text-label-secondary"
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="tab-bar-active"
                          transition={spring.snappy}
                          className="absolute inset-0 rounded-2xl bg-sage-light"
                        />
                      )}
                      <motion.span
                        key={active ? "active" : "idle"}
                        initial={active ? { transform: "scale(0.82)" } : false}
                        animate={{ transform: "scale(1)" }}
                        transition={spring.pop}
                        className="relative"
                      >
                        <Icon aria-hidden size={20} strokeWidth={active ? 2.25 : 1.85} />
                      </motion.span>
                      <span className="relative max-w-full truncate px-0.5">{dict.nav[key]}</span>
                    </Link>
                  </li>
                );
              })}
          </ul>
        </nav>
      </div>
    </div>
  );
}
