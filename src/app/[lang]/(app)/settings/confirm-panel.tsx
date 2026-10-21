"use client";

import { useId, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useI18n } from "@/i18n/dictionary-provider";
import { easeOut } from "@/lib/motion";

/**
 * Opens under a row to ask before something that can't be taken back: what will happen, Cancel, and the
 * action. Says so in place if it fails.
 */
export function ConfirmPanel({
  open,
  title,
  body,
  confirm,
  destructive = true,
  failure,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  confirm: string;
  destructive?: boolean;
  /** Shown instead of the body when onConfirm throws. */
  failure: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}) {
  const { dict } = useI18n();
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const run = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await onConfirm();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.24, ease: easeOut }}
          className="overflow-hidden"
        >
          <div role="alertdialog" aria-labelledby={id} className="px-4 pb-4">
            <p id={id} className="text-[15px] font-semibold">
              {title}
            </p>
            <p className="mt-1 text-[13px] leading-snug text-label-secondary">{failed ? failure : body}</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setFailed(false);
                  onCancel();
                }}
                disabled={busy}
                className="min-h-11 flex-1 rounded-full bg-fill text-[15px] font-semibold text-label transition-transform duration-150 ease-out active:scale-[0.97]"
              >
                {dict.prefs.cancel}
              </button>
              <button
                type="button"
                onClick={() => void run()}
                disabled={busy}
                className={`min-h-11 flex-1 rounded-full text-[15px] font-semibold transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-60 ${
                  destructive ? "bg-danger text-white" : "bg-accent text-accent-contrast"
                }`}
              >
                {confirm}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
