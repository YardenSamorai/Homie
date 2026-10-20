"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useI18n } from "@/i18n/dictionary-provider";
import { useAuth } from "@/lib/auth/session";
import { easeOut } from "@/lib/motion";

const GUIDE_KEY = "homie-guides";

type GuideId = "today" | "tasks" | "shopping" | "calendar" | "settings";

function guideId(pathname: string, locale: string): GuideId | null {
  const path = pathname.replace(`/${locale}`, "") || "/";
  if (path === "/") return "today";
  if (path.startsWith("/tasks")) return "tasks";
  if (path.startsWith("/shopping")) return "shopping";
  if (path.startsWith("/calendar")) return "calendar";
  if (path.startsWith("/settings")) return "settings";
  return null;
}

function readDone(userId: string): Record<string, string> {
  try {
    const all = JSON.parse(localStorage.getItem(GUIDE_KEY) ?? "{}") as Record<string, Record<string, string>>;
    return all[userId] ?? {};
  } catch {
    return {};
  }
}

function writeDone(userId: string, id: string, status: "done" | "skipped") {
  try {
    const all = JSON.parse(localStorage.getItem(GUIDE_KEY) ?? "{}") as Record<string, Record<string, string>>;
    all[userId] = { ...(all[userId] ?? {}), [id]: status };
    localStorage.setItem(GUIDE_KEY, JSON.stringify(all));
  } catch {
    /* private mode */
  }
}

/** One short card the first time each main screen opens. Stored per signed-in user. */
export function ScreenGuide() {
  const pathname = usePathname();
  const { locale, dict } = useI18n();
  const userId = useAuth((s) => s.session?.userId) ?? "local";
  const id = guideId(pathname, locale);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    const seen = readDone(userId)[`${id}-v1`];
    setOpen(!seen);
  }, [id, userId]);

  if (!id) return null;
  const copy = dict.guides[id];

  const close = (status: "done" | "skipped") => {
    writeDone(userId, `${id}-v1`, status);
    setOpen(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, transform: "translateY(12px)" }}
          animate={{ opacity: 1, transform: "translateY(0px)" }}
          exit={{ opacity: 0, transform: "translateY(8px)" }}
          transition={{ duration: 0.22, ease: easeOut }}
          className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+7.25rem)] z-30 mx-auto w-[min(100%-2rem,28rem)] rounded-[24px] bg-surface p-4 text-label shadow-[0_16px_40px_rgb(37_79_65/0.16)] md:bottom-8 md:start-72"
          role="dialog"
          aria-labelledby="screen-guide-title"
        >
          <p id="screen-guide-title" className="text-[17px] font-bold tracking-tight">
            {copy.title}
          </p>
          <p className="mt-1 text-[15px] leading-snug text-label-secondary">{copy.body}</p>
          <div className="mt-3 flex items-center justify-between">
            <button type="button" onClick={() => close("skipped")} className="min-h-11 px-2 text-[15px] font-semibold text-label-secondary">
              {dict.guides.skip}
            </button>
            <button
              type="button"
              onClick={() => close("done")}
              className="min-h-11 rounded-full bg-accent px-5 text-[15px] font-semibold text-accent-contrast shadow-[0_6px_16px_color-mix(in_oklab,var(--accent)_28%,transparent),inset_0_1px_0_rgb(255_255_255/0.28)] active:scale-[0.97]"
            >
              {dict.guides.done}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function replayGuides(userId: string) {
  try {
    const all = JSON.parse(localStorage.getItem(GUIDE_KEY) ?? "{}") as Record<string, Record<string, string>>;
    delete all[userId];
    localStorage.setItem(GUIDE_KEY, JSON.stringify(all));
  } catch {
    /* private mode */
  }
}
