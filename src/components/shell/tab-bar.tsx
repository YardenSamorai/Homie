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
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(env(safe-area-inset-bottom),12px)] md:hidden">
      <div className="mx-auto flex max-w-lg items-center gap-2.5">
        <nav
          aria-label={dict.nav.main}
          className="material pointer-events-auto flex-1 rounded-full p-1 shadow-[0_8px_30px_rgb(0_0_0/0.12),0_1px_2px_rgb(0_0_0/0.06)] ring-1 ring-[light-dark(rgb(0_0_0/0.04),rgb(255_255_255/0.1))]"
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
                      className={`relative flex h-14 flex-col items-center justify-center gap-0.5 rounded-full text-[10px] font-semibold transition-[color,scale] duration-150 ease-out active:scale-95 ${
                        active ? "text-accent" : "text-label"
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="tab-bar-active"
                          transition={spring.snappy}
                          className="absolute inset-0 rounded-full bg-[light-dark(rgb(0_0_0/0.06),rgb(255_255_255/0.12))]"
                        />
                      )}
                      <motion.span
                        key={active ? "active" : "idle"}
                        initial={active ? { transform: "scale(0.82)" } : false}
                        animate={{ transform: "scale(1)" }}
                        transition={spring.pop}
                        className="relative"
                      >
                        <Icon aria-hidden size={23} strokeWidth={active ? 2.25 : 1.85} />
                      </motion.span>
                      <span className="relative">{dict.nav[key]}</span>
                    </Link>
                  </li>
                );
              })}
          </ul>
        </nav>

        <button
          type="button"
          onClick={() => show(addKindFor(pathname, locale), selectedDay)}
          aria-label={dict.add.open}
          aria-haspopup="dialog"
          className="pointer-events-auto flex size-16 shrink-0 items-center justify-center rounded-full bg-accent text-white shadow-[0_8px_24px_color-mix(in_oklab,var(--accent)_40%,transparent),0_1px_2px_rgb(0_0_0/0.1)] transition-[scale] duration-150 ease-out active:scale-90"
        >
          <Plus aria-hidden size={28} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
