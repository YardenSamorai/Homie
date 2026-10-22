"use client";

import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Check } from "lucide-react";
import { easeOut } from "@/lib/motion";

const VISIBLE_MS = 4000;
const noop = () => () => {};

/**
 * A glass pill above the tab bar that confirms what just happened and offers to take it back. It leaves on
 * its own; a new one replaces it rather than stacking.
 */
export function UndoToast({
  toast,
  label,
  undoLabel,
  onUndo,
  onDismiss,
}: {
  toast: { id: string; title: string } | null;
  label: string;
  undoLabel: string;
  onUndo: (id: string) => void;
  onDismiss: () => void;
}) {
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(onDismiss, VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [toast, onDismiss]);

  // On the body, so a page that recedes behind a sheet or isolates its layers can't carry it along.
  if (!mounted) return null;
  return createPortal(
    <div
      aria-live="polite"
      className="keyboard-hides pointer-events-none fixed inset-x-0 bottom-[calc(max(env(safe-area-inset-bottom),10px)+70px)] z-40 flex justify-center px-4 md:bottom-6"
    >
      <AnimatePresence mode="popLayout">
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, transform: "translateY(12px) scale(0.96)" }}
            animate={{ opacity: 1, transform: "translateY(0px) scale(1)" }}
            exit={{ opacity: 0, transform: "translateY(8px) scale(0.98)", transition: { duration: 0.15, ease: easeOut } }}
            transition={{ duration: 0.22, ease: easeOut }}
            className="material pointer-events-auto flex min-h-12 max-w-md items-center gap-2.5 rounded-full py-1.5 ps-3 pe-1.5 shadow-[0_8px_28px_rgb(30_40_35/0.16)] ring-1 ring-[light-dark(rgb(30_40_35/0.06),rgb(255_255_255/0.09))]"
          >
            <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-full bg-green text-white">
              <Check size={14} strokeWidth={3} />
            </span>
            <p className="min-w-0 truncate text-[15px]">
              <span className="font-semibold">{label}</span>
              <span className="text-label-secondary">
                {" · "}
                <bdi>{toast.title}</bdi>
              </span>
            </p>
            <button
              type="button"
              onClick={() => onUndo(toast.id)}
              className="min-h-9 shrink-0 rounded-full px-3.5 text-[15px] font-semibold text-accent transition-[background-color,scale] duration-150 ease-out active:scale-95 active:bg-fill"
            >
              {undoLabel}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
