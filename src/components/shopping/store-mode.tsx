"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ShoppingBasket } from "lucide-react";
import { AisleIcon } from "@/components/shopping/aisle-icon";
import { AISLES, type Aisle } from "@/lib/aisles";
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
      <img
        src={url}
        alt={label}
        className="max-h-[80dvh] max-w-full rounded-2xl object-contain"
        onClick={(event) => event.stopPropagation()}
      />
    </div>
  );
}

const aisleId = (aisle: Aisle) => `store-${aisle}`;

/**
 * The aisles you walk through, as a row that stays on top: each says what's left in it, a tap jumps there,
 * the one you're in is lit, and the ones you've finished get a check.
 */
function AisleBar({
  aisles,
  left,
  active,
}: {
  aisles: Aisle[];
  left: Partial<Record<Aisle, number>>;
  active: Aisle | null;
}) {
  const { dict } = useI18n();
  const copy = dict.shopping;
  const chips = useRef(new Map<Aisle, HTMLButtonElement>());

  useEffect(() => {
    if (active) chips.current.get(active)?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [active]);

  return (
    <nav
      aria-label={copy.aislesNav}
      className="sticky top-[env(safe-area-inset-top,0px)] z-10 -mx-4 bg-[color-mix(in_oklab,var(--bg)_88%,transparent)] py-2 backdrop-blur-md"
    >
      <div className="flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {aisles.map((aisle) => {
          const count = left[aisle] ?? 0;
          const done = count === 0;
          const name = copy.aisles[aisle];
          return (
            <button
              key={aisle}
              ref={(node) => {
                if (node) chips.current.set(aisle, node);
                else chips.current.delete(aisle);
              }}
              type="button"
              disabled={done}
              aria-current={aisle === active ? "location" : undefined}
              aria-label={done ? format(copy.aisleDone, { name }) : format(copy.aisleJump, { name, count })}
              onClick={() =>
                document.getElementById(aisleId(aisle))?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
              className={`flex min-h-11 shrink-0 items-center gap-2 rounded-full ps-1.5 pe-3.5 text-[15px] font-semibold transition-[background-color,box-shadow,opacity,scale] duration-200 ease-out active:scale-[0.97] ${
                aisle === active
                  ? "bg-surface text-label shadow-card ring-2 ring-accent"
                  : "bg-surface text-label shadow-card ring-1 ring-hairline"
              } ${done ? "opacity-50" : ""}`}
            >
              {done ? (
                <span
                  aria-hidden
                  className="flex size-8 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--green)_16%,var(--surface))] text-green"
                >
                  <Check size={17} strokeWidth={2.6} />
                </span>
              ) : (
                <AisleIcon aisle={aisle} size={32} />
              )}
              <span className={done ? "line-through decoration-label-tertiary" : undefined}>{name}</span>
              {!done && <span className="tabular-nums text-label-tertiary">{count}</span>}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/** The list you hold in the aisle: what's left, large, grouped by aisle, and a check takes it off the screen. */
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
  const left: Partial<Record<Aisle, number>> = {};
  for (const item of items) left[item.category ?? "other"] = (left[item.category ?? "other"] ?? 0) + 1;
  const groups = AISLES.flatMap((aisle) =>
    left[aisle] ? [{ aisle, items: items.filter((item) => (item.category ?? "other") === aisle) }] : []
  );
  // Every aisle that had something when you walked in stays in the bar, so finishing one shows.
  const [walked, setWalked] = useState<Aisle[]>(() => groups.map((group) => group.aisle));
  const aisles = AISLES.filter((aisle) => walked.includes(aisle) || left[aisle]);
  if (aisles.length !== walked.length) setWalked(aisles);
  const [active, setActive] = useState<Aisle | null>(groups[0]?.aisle ?? null);
  const open = groups.map((group) => group.aisle).join(",");

  useEffect(() => {
    const present = open ? (open.split(",") as Aisle[]) : [];
    let frame = 0;
    const measure = () => {
      frame = 0;
      // The aisle whose heading last passed under the bar is the one you're in.
      let current = present[0] ?? null;
      for (const aisle of present) {
        const top = document.getElementById(aisleId(aisle))?.getBoundingClientRect().top;
        if (top !== undefined && top < 140) current = aisle;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [open]);

  return (
    <div className="flex flex-col gap-4 pt-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-[34px] font-bold leading-tight tracking-tight">{copy.store}</h1>
        <button type="button" onClick={onExit} className="min-h-11 shrink-0 px-1 text-[17px] font-semibold text-accent">
          {copy.storeDone}
        </button>
      </header>
      {items.length > 0 && aisles.length > 1 && <AisleBar aisles={aisles} left={left} active={active} />}
      {items.length === 0 ? (
        <div className="rounded-card bg-surface shadow-card">
          <EmptyState icon={ShoppingBasket} tint="var(--green)" title={copy.storeEmpty} hint={copy.storeEmptyHint} />
        </div>
      ) : (
        <AnimatePresence initial={false}>
          {groups.map(({ aisle, items: aisleItems }) => (
            <motion.section
              key={aisle}
              id={aisleId(aisle)}
              aria-labelledby={`${aisleId(aisle)}-title`}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: easeOut }}
              className="scroll-mt-[calc(env(safe-area-inset-top,0px)+76px)] overflow-hidden"
            >
              <h2
                id={`${aisleId(aisle)}-title`}
                className="flex items-center gap-2.5 px-1 pb-2.5 text-[22px] font-bold tracking-tight"
              >
                <AisleIcon aisle={aisle} size={32} />
                {copy.aisles[aisle]}
                <span className="font-semibold tabular-nums text-label-tertiary">{aisleItems.length}</span>
              </h2>
              <ul className="overflow-hidden rounded-card bg-surface shadow-card">
                <AnimatePresence initial={false}>
                  {aisleItems.map((item) => {
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
            </motion.section>
          ))}
        </AnimatePresence>
      )}
    </div>
  );
}
