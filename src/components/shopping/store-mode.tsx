"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, SearchX, ShoppingBasket } from "lucide-react";
import { AisleIcon } from "@/components/shopping/aisle-icon";
import { AISLES, type Aisle } from "@/lib/aisles";
import { CheckCircle } from "@/components/ui/check-circle";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressRing } from "@/components/ui/progress-ring";
import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
import type { ShoppingItem } from "@/lib/household";
import { easeOut, spring } from "@/lib/motion";
import { signedUrls } from "@/lib/supabase/media";
import { Askers, ItemMeta } from "./item-meta";

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

const rowMotion = {
  initial: { height: 0, opacity: 0 },
  animate: { height: "auto", opacity: 1 },
  exit: { height: 0, opacity: 0 },
  transition: { duration: 0.24, ease: easeOut },
};

function StoreRow({
  item,
  url,
  checked,
  onCheck,
  onOpenPhoto,
  children,
}: {
  item: ShoppingItem;
  url?: string;
  checked: boolean;
  onCheck: () => void;
  onOpenPhoto: (item: ShoppingItem, url: string) => void;
  children?: React.ReactNode;
}) {
  const { dict } = useI18n();
  const copy = dict.shopping;
  return (
    <motion.li {...rowMotion} className="overflow-hidden border-b border-separator last:border-b-0">
      <div className={`flex items-start gap-3 px-4 py-3 ${checked ? "min-h-16" : "min-h-[88px]"}`}>
        <motion.button
          type="button"
          onClick={onCheck}
          whileTap={{ scale: 0.88 }}
          transition={spring.snappy}
          aria-pressed={checked}
          aria-label={format(checked ? copy.unmark : copy.mark, { name: item.name })}
          className="-m-2 flex size-14 shrink-0 items-center justify-center rounded-full"
        >
          <span className={checked ? "" : "scale-125"}>
            <CheckCircle checked={checked} color="var(--green)" />
          </span>
        </motion.button>
        <div className="flex min-w-0 flex-1 flex-col gap-1 self-center">
          <p
            dir="auto"
            className={`leading-snug [overflow-wrap:anywhere] ${checked ? "text-[17px] text-label-secondary" : "text-[22px] font-semibold"}`}
          >
            {item.name}
          </p>
          {!checked && <ItemMeta item={item} large />}
          {children}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2 self-center">
          {url && (
            <button type="button" onClick={() => onOpenPhoto(item, url)} aria-label={format(copy.photo, { name: item.name })} className="rounded-2xl">
              <img src={url} alt="" className={`rounded-2xl object-cover ${checked ? "size-11" : "size-[72px]"}`} />
            </button>
          )}
          {!checked && <Askers item={item} size={22} dim />}
        </div>
      </div>
    </motion.li>
  );
}

/**
 * The list you hold in the aisle: what's left, large, grouped by aisle. A check puts it in the basket, "not
 * found" sets it aside without counting it as bought, and both stay reachable underneath to fix a mistake.
 * Leaving and finishing are separate: leaving keeps everything as is, finishing files the trip.
 */
export function StoreMode({
  items,
  urls,
  onExit,
  onFinish,
  onCheck,
  onUncheck,
  onMissing,
  onFound,
  onOpenPhoto,
}: {
  items: ShoppingItem[];
  urls: Record<string, string>;
  onExit: () => void;
  onFinish: () => void;
  onCheck: (id: string) => void;
  onUncheck: (id: string) => void;
  onMissing: (id: string) => void;
  onFound: (id: string) => void;
  onOpenPhoto: (item: ShoppingItem, url: string) => void;
}) {
  const { dict } = useI18n();
  const copy = dict.shopping;
  const toBuy = items.filter((item) => !item.checkedAt && !item.missingAt);
  const missing = items.filter((item) => !item.checkedAt && item.missingAt);
  const basket = items.filter((item) => item.checkedAt).sort((a, b) => (b.checkedAt ?? "").localeCompare(a.checkedAt ?? ""));
  const [showBasket, setShowBasket] = useState(false);
  const aisleOf = (item: ShoppingItem) => item.category ?? "other";
  const left: Partial<Record<Aisle, number>> = {};
  const total: Partial<Record<Aisle, number>> = {};
  for (const item of toBuy) left[aisleOf(item)] = (left[aisleOf(item)] ?? 0) + 1;
  for (const item of items) total[aisleOf(item)] = (total[aisleOf(item)] ?? 0) + 1;
  const groups = AISLES.flatMap((aisle) => (left[aisle] ? [{ aisle, items: toBuy.filter((item) => aisleOf(item) === aisle) }] : []));
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

  const progress = [
    format(copy.inCart, { bought: basket.length, total: items.length }),
    missing.length > 0 ? format(copy.missingCount, { count: missing.length }) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-4 pt-4">
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-[34px] font-bold leading-tight tracking-tight">{copy.store}</h1>
          <button type="button" onClick={onExit} className="min-h-11 shrink-0 px-1 text-[17px] text-accent">
            {copy.storeExit}
          </button>
        </div>
        <div className="flex min-h-11 items-center gap-3">
          <ProgressRing value={items.length ? basket.length / items.length : 0} size={22} stroke={2.75} color="var(--green)" />
          <p className="min-w-0 flex-1 text-[15px] font-medium text-label-secondary" aria-live="polite">
            {progress}
          </p>
          {basket.length > 0 && (
            <button
              type="button"
              onClick={onFinish}
              className="min-h-11 shrink-0 rounded-full bg-accent px-4 text-[15px] font-semibold text-accent-contrast transition-transform duration-150 ease-out active:scale-[0.97]"
            >
              {copy.finish}
            </button>
          )}
        </div>
      </header>
      {toBuy.length > 0 && aisles.length > 1 && <AisleBar aisles={aisles} left={left} active={active} />}
      {toBuy.length === 0 ? (
        <div className="rounded-card bg-surface shadow-card">
          <EmptyState
            icon={ShoppingBasket}
            tint="var(--green)"
            title={missing.length > 0 ? copy.storeEmptyMissing : copy.storeEmpty}
            hint={copy.storeEmptyHint}
          />
        </div>
      ) : (
        <AnimatePresence initial={false}>
          {groups.map(({ aisle, items: aisleItems }) => (
            <motion.section
              key={aisle}
              id={aisleId(aisle)}
              aria-labelledby={`${aisleId(aisle)}-title`}
              {...rowMotion}
              transition={{ duration: 0.28, ease: easeOut }}
              className="scroll-mt-[calc(env(safe-area-inset-top,0px)+76px)] overflow-hidden"
            >
              <h2 id={`${aisleId(aisle)}-title`} className="flex items-center gap-2.5 px-1 pb-2.5 text-[22px] font-bold tracking-tight">
                <AisleIcon aisle={aisle} size={32} />
                {copy.aisles[aisle]}
                <span className="ms-auto text-[15px] font-semibold tabular-nums text-label-tertiary">
                  <span className="sr-only">{format(copy.aisleProgress, { done: (total[aisle] ?? 0) - aisleItems.length, total: total[aisle] ?? 0 })}</span>
                  <span aria-hidden>
                    {(total[aisle] ?? 0) - aisleItems.length}/{total[aisle] ?? 0}
                  </span>
                </span>
              </h2>
              <ul className="overflow-hidden rounded-card bg-surface shadow-card">
                <AnimatePresence initial={false}>
                  {aisleItems.map((item) => (
                    <StoreRow
                      key={item.id}
                      item={item}
                      url={item.photoPath ? urls[item.photoPath] : undefined}
                      checked={false}
                      onCheck={() => onCheck(item.id)}
                      onOpenPhoto={onOpenPhoto}
                    >
                      <button
                        type="button"
                        onClick={() => onMissing(item.id)}
                        aria-label={format(copy.missingNamed, { name: item.name })}
                        className="flex min-h-11 items-center gap-1.5 self-start rounded-full bg-fill px-3.5 text-[15px] font-medium text-label transition-transform duration-150 ease-out active:scale-[0.97]"
                      >
                        <SearchX aria-hidden size={16} strokeWidth={2.25} className="text-orange" />
                        {copy.missing}
                      </button>
                    </StoreRow>
                  ))}
                </AnimatePresence>
              </ul>
            </motion.section>
          ))}
        </AnimatePresence>
      )}

      {missing.length > 0 && (
        <section aria-labelledby="store-missing">
          <h2 id="store-missing" className="flex items-center gap-2 px-1 pb-2.5 text-[17px] font-semibold">
            <SearchX aria-hidden size={18} strokeWidth={2.25} className="text-orange" />
            {copy.missingSection}
            <span className="font-medium tabular-nums text-label-tertiary">{missing.length}</span>
          </h2>
          <ul className="overflow-hidden rounded-card bg-surface shadow-card">
            <AnimatePresence initial={false}>
              {missing.map((item) => (
                <StoreRow
                  key={item.id}
                  item={item}
                  url={item.photoPath ? urls[item.photoPath] : undefined}
                  checked={false}
                  onCheck={() => onCheck(item.id)}
                  onOpenPhoto={onOpenPhoto}
                >
                  <button
                    type="button"
                    onClick={() => onFound(item.id)}
                    className="flex min-h-11 items-center self-start rounded-full bg-fill px-3.5 text-[15px] font-medium text-label transition-transform duration-150 ease-out active:scale-[0.97]"
                  >
                    {copy.foundAfterAll}
                  </button>
                </StoreRow>
              ))}
            </AnimatePresence>
          </ul>
        </section>
      )}

      {basket.length > 0 && (
        <section aria-label={copy.basketSection}>
          <button
            type="button"
            onClick={() => setShowBasket((shown) => !shown)}
            aria-expanded={showBasket}
            className="flex min-h-11 items-center gap-1.5 px-1 text-[17px] font-semibold text-label-secondary"
          >
            <ChevronDown
              aria-hidden
              size={18}
              strokeWidth={2.4}
              className={`transition-transform duration-200 ease-out ${showBasket ? "" : "-rotate-90 rtl:rotate-90"}`}
            />
            {copy.basketSection}
            <span className="font-medium tabular-nums text-label-tertiary">{basket.length}</span>
          </button>
          <AnimatePresence initial={false}>
            {showBasket && (
              <motion.ul {...rowMotion} className="mt-2 overflow-hidden rounded-card bg-surface shadow-card">
                <AnimatePresence initial={false}>
                  {basket.map((item) => (
                    <StoreRow
                      key={item.id}
                      item={item}
                      url={item.photoPath ? urls[item.photoPath] : undefined}
                      checked
                      onCheck={() => onUncheck(item.id)}
                      onOpenPhoto={onOpenPhoto}
                    />
                  ))}
                </AnimatePresence>
              </motion.ul>
            )}
          </AnimatePresence>
          {toBuy.length === 0 && (
            <button
              type="button"
              onClick={onFinish}
              className="mt-4 min-h-12 w-full rounded-xl bg-accent text-[17px] font-semibold text-accent-contrast transition-transform duration-150 ease-out active:scale-[0.98]"
            >
              {copy.finish}
            </button>
          )}
        </section>
      )}
    </div>
  );
}
