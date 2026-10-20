"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Share, SquarePlus } from "lucide-react";
import { HomieMark } from "@/components/brand/homie-mark";
import { Card } from "@/components/ui/card";
import { useI18n } from "@/i18n/dictionary-provider";
import { useAuth } from "@/lib/auth/session";
import { dismissInstall, installDismissed, promptInstall, useInstallMode } from "@/lib/install";
import { easeOut } from "@/lib/motion";
import { guideSeen } from "./screen-guide";

const primary =
  "min-h-11 rounded-full bg-accent px-5 text-[15px] font-semibold text-accent-contrast shadow-[0_6px_16px_color-mix(in_oklab,var(--accent)_28%,transparent),inset_0_1px_0_rgb(255_255_255/0.28)] transition-transform duration-150 ease-out active:scale-[0.97]";

/** Safari has no install dialog: the two taps that put Homie on the Home Screen, with the icons people will look for. */
function IosSteps() {
  const { dict } = useI18n();
  const steps = [
    { icon: Share, text: dict.install.stepShare },
    { icon: SquarePlus, text: dict.install.stepAdd },
  ];
  return (
    <ol className="flex flex-col gap-2.5">
      {steps.map(({ icon: Icon, text }, index) => (
        <li key={index} className="flex items-start gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-fill text-accent">
            <Icon className="size-[18px]" strokeWidth={2.2} aria-hidden />
          </span>
          <span className="pt-1 text-[15px] leading-snug text-label-secondary">{text}</span>
        </li>
      ))}
    </ol>
  );
}

/** Once, on Today, after its guide: offer to install. Settings keeps the same offer for later. */
export function InstallPrompt() {
  const pathname = usePathname();
  const { locale, dict } = useI18n();
  const userId = useAuth((s) => s.session?.userId) ?? "local";
  const mode = useInstallMode();
  const [open, setOpen] = useState(false);
  const onToday = pathname === `/${locale}` || pathname === `/${locale}/`;
  const offer = mode === "prompt" || mode === "ios";

  useEffect(() => {
    if (!onToday || !offer || installDismissed() || !guideSeen(userId, "today")) return;
    const timer = window.setTimeout(() => setOpen(true), 1200);
    return () => window.clearTimeout(timer);
  }, [onToday, offer, userId]);

  const close = () => {
    dismissInstall();
    setOpen(false);
  };

  const install = async () => {
    await promptInstall();
    close();
  };

  return (
    <AnimatePresence>
      {open && onToday && offer && (
        <motion.div
          initial={{ opacity: 0, transform: "translateY(12px)" }}
          animate={{ opacity: 1, transform: "translateY(0px)" }}
          exit={{ opacity: 0, transform: "translateY(8px)" }}
          transition={{ duration: 0.22, ease: easeOut }}
          className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+7.25rem)] z-30 mx-auto w-[min(100%-2rem,28rem)] rounded-[24px] bg-surface p-4 text-label shadow-[0_16px_40px_rgb(37_79_65/0.16)] md:bottom-8 md:start-72"
          role="dialog"
          aria-labelledby="install-title"
        >
          <div className="flex items-center gap-3">
            <HomieMark size={44} />
            <div className="min-w-0">
              <p id="install-title" className="text-[17px] font-bold tracking-tight">
                {dict.install.title}
              </p>
              <p className="mt-0.5 text-[15px] leading-snug text-label-secondary">{dict.install.body}</p>
            </div>
          </div>
          {mode === "ios" && (
            <div className="mt-4">
              <IosSteps />
            </div>
          )}
          {mode === "prompt" ? (
            <div className="mt-3 flex items-center justify-between">
              <button type="button" onClick={close} className="min-h-11 px-2 text-[15px] font-semibold text-label-secondary">
                {dict.install.later}
              </button>
              <button type="button" onClick={() => void install()} className={primary}>
                {dict.install.action}
              </button>
            </div>
          ) : (
            <div className="mt-4 flex justify-end">
              <button type="button" onClick={close} className={primary}>
                {dict.install.gotIt}
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Settings: the same offer, for anyone who said "not now". Hidden once installed or where there's nothing to offer. */
export function InstallCard() {
  const { dict } = useI18n();
  const mode = useInstallMode();
  if (mode !== "prompt" && mode !== "ios") return null;

  return (
    <Card title={dict.install.settingsTitle}>
      <div className="flex flex-col gap-4 p-4">
        <div className="flex items-center gap-3">
          <HomieMark size={44} />
          <div className="min-w-0">
            <p className="text-[17px] font-semibold tracking-tight">{dict.install.title}</p>
            <p className="mt-0.5 text-[15px] leading-snug text-label-secondary">{dict.install.body}</p>
          </div>
        </div>
        {mode === "ios" ? (
          <IosSteps />
        ) : (
          <button type="button" onClick={() => void promptInstall()} className={`${primary} self-start`}>
            {dict.install.action}
          </button>
        )}
      </div>
    </Card>
  );
}
