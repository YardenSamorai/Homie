"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Plus } from "lucide-react";
import { useI18n } from "@/i18n/dictionary-provider";
import { useAddSheet, useSelectedDay } from "@/lib/household-store";
import { spring } from "@/lib/motion";
import { addKindFor, isActive, navItems } from "./nav-items";

const glass =
  "material pointer-events-auto shadow-[0_8px_28px_rgb(30_40_35/0.12),0_1px_2px_rgb(30_40_35/0.06)] ring-1 ring-[light-dark(rgb(30_40_35/0.06),rgb(255_255_255/0.09))]";

/**
 * iOS 26-style floating glass tab bar. The selected tab is told by its tint alone; the add action sits
 * beside the bar as its own circle, at the trailing edge, the way iOS sets a bar's accessory apart.
 */
export function TabBar() {
  const pathname = usePathname();
  const { locale, dict } = useI18n();
  const show = useAddSheet((s) => s.show);
  const selectedDay = useSelectedDay((s) => s.day);

  return (
    <div className="keyboard-hides pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(env(safe-area-inset-bottom),10px)] md:hidden">
      <div className="mx-auto flex max-w-lg items-center gap-2">
        <nav aria-label={dict.nav.main} className={`${glass} min-w-0 flex-1 rounded-full px-1`}>
          <ul className="flex">
            {navItems
              .filter((item) => item.inTabBar)
              .map(({ key, path, icon: Icon }) => {
                const active = isActive(pathname, locale, path);
                return (
                  <li key={key} className="min-w-0 flex-1">
                    <Link
                      href={`/${locale}${path}`}
                      aria-current={active ? "page" : undefined}
                      className={`flex h-[58px] flex-col items-center justify-center gap-[3px] text-[10px] transition-[color,scale] duration-150 ease-out active:scale-95 ${
                        active ? "font-semibold text-accent" : "font-medium text-label-secondary"
                      }`}
                    >
                      <motion.span
                        key={active ? "active" : "idle"}
                        initial={active ? { transform: "scale(0.85)" } : false}
                        animate={{ transform: "scale(1)" }}
                        transition={spring.pop}
                        className="flex"
                      >
                        <Icon aria-hidden size={22} strokeWidth={active ? 2.25 : 1.75} />
                      </motion.span>
                      <span className="max-w-full truncate px-0.5">{dict.nav[key]}</span>
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
          className="pointer-events-auto flex size-[58px] shrink-0 items-center justify-center rounded-full bg-accent text-accent-contrast shadow-[0_8px_22px_color-mix(in_oklab,var(--accent)_34%,transparent),inset_0_1px_0_rgb(255_255_255/0.28)] transition-transform duration-150 ease-out active:scale-95"
        >
          <Plus aria-hidden size={26} strokeWidth={2.25} />
        </button>
      </div>
    </div>
  );
}
