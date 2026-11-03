"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ShoppingBasket } from "lucide-react";
import { CheckCircle } from "@/components/ui/check-circle";
import { EmptyState } from "@/components/ui/empty-state";
import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
import type { ShoppingItem } from "@/lib/household";
import { easeOut, spring } from "@/lib/motion";
import { signedUrls } from "@/lib/supabase/media";

export function useSignedPhotos(paths: string[]) {
  const key = [...paths].sort().join("\n");
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    const list = key ? key.split("\n") : [];
    if (list.length === 0) return;
    let live = true;
    void signedUrls(list).then((next) => {
      if (live) setUrls(next);
    });
    return () => {
      live = false;
    };
  }, [key]);
  return urls;
}

export function PhotoLight({ url, name, onClose }: { url: string; name: string; onClose: () => void }) {
  const { dict } = useI18n();
  const label = format(dict.shopping.photo, { name });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute end-4 top-[max(1rem,env(safe-area-inset-top))] min-h-11 px-3 text-[17px] font-semibold text-white"
      >
        {dict.shopping.closePhoto}
      </button>
      <img src={url} alt={label} className="max-h-[80dvh] max-w-full rounded-2xl object-contain" onClick={(event) => event.stopPropagation()} />
    </div>
  );
}

/** The list you hold in the aisle: what's left, large, and a check takes it off the screen. */
export function StoreMode({
  items,
  urls,
  onExit,
  onCheck,
  onOpenPhoto,
}: {
  items: ShoppingItem[];
  urls: Record<string, string>;
  onExit: () => void;
  onCheck: (id: string) => void;
  onOpenPhoto: (item: ShoppingItem, url: string) => void;
}) {
  const { dict } = useI18n();
  const copy = dict.shopping;

  return (
    <div className="flex flex-col gap-4 pt-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-[34px] font-bold leading-tight tracking-tight">{copy.store}</h1>
        <button type="button" onClick={onExit} className="min-h-11 shrink-0 px-1 text-[17px] font-semibold text-accent">
          {copy.storeDone}
        </button>
      </header>
      {items.length === 0 ? (
        <div className="rounded-card bg-surface shadow-card">
          <EmptyState icon={ShoppingBasket} tint="var(--green)" title={copy.storeEmpty} hint={copy.storeEmptyHint} />
        </div>
      ) : (
        <ul className="overflow-hidden rounded-card bg-surface shadow-card">
          <AnimatePresence initial={false}>
            {items.map((item) => {
              const url = item.photoPath ? urls[item.photoPath] : undefined;
              return (
                <motion.li
                  key={item.id}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.24, ease: easeOut }}
                  className="overflow-hidden border-b border-separator last:border-b-0"
                >
                  <div className="flex min-h-[88px] items-center gap-3 px-4 py-3">
                    <motion.button
                      type="button"
                      onClick={() => onCheck(item.id)}
                      whileTap={{ scale: 0.88 }}
                      transition={spring.snappy}
                      aria-label={format(copy.mark, { name: item.name })}
                      className="-m-2 flex size-14 shrink-0 items-center justify-center rounded-full"
                    >
                      <span className="scale-125">
                        <CheckCircle checked={false} color="var(--green)" />
                      </span>
                    </motion.button>
                    <div className="min-w-0 flex-1">
                      <p dir="auto" className="text-[22px] font-semibold leading-snug [overflow-wrap:anywhere]">
                        {item.name}
                      </p>
                      {item.note && <p className="truncate text-[15px] text-label-secondary">{item.note}</p>}
                    </div>
                    {url && (
                      <button
                        type="button"
                        onClick={() => onOpenPhoto(item, url)}
                        aria-label={format(copy.photo, { name: item.name })}
                        className="shrink-0 rounded-2xl"
                      >
                        <img src={url} alt="" className="size-[72px] rounded-2xl object-cover" />
                      </button>
                    )}
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
