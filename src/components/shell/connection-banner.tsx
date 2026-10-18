"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Wifi, WifiOff } from "lucide-react";
import { useI18n } from "@/i18n/dictionary-provider";
import { useOnlineStatus } from "@/lib/use-online-status";

const RECONNECTED_VISIBLE_MS = 2500;

export function ConnectionBanner() {
  const online = useOnlineStatus();
  const { dict } = useI18n();
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onOnline = () => {
      clearTimeout(timer);
      setShowReconnected(true);
      timer = setTimeout(() => setShowReconnected(false), RECONNECTED_VISIBLE_MS);
    };
    const onOffline = () => {
      clearTimeout(timer);
      setShowReconnected(false);
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const state = !online ? "offline" : showReconnected ? "online" : null;

  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center pt-safe">
      <AnimatePresence>
        {state && (
          <motion.div
            key={state}
            initial={{ opacity: 0, transform: "translateY(-12px) scale(0.96)" }}
            animate={{ opacity: 1, transform: "translateY(0px) scale(1)" }}
            exit={{ opacity: 0, transform: "translateY(-12px) scale(0.96)" }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className={`mx-4 mt-2 flex max-w-md items-center gap-2.5 rounded-2xl bg-surface-raised/95 px-4 py-2.5 text-[13px] font-medium shadow-[0_8px_30px_rgb(0_0_0/0.18)] ring-1 ring-separator backdrop-blur-xl ${
              state === "offline" ? "text-label" : "text-success"
            }`}
          >
            {state === "offline" ? (
              <WifiOff aria-hidden size={16} className="shrink-0 text-warning" />
            ) : (
              <Wifi aria-hidden size={16} className="shrink-0" />
            )}
            {dict.connection[state]}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
