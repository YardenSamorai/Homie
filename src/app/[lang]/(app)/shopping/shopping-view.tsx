"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, ListChecks, Plus, ShoppingBasket } from "lucide-react";
import { PageStage } from "@/components/shell/page-stage";
import { FinishSheet } from "@/components/shopping/finish-sheet";
import { Askers, ItemMeta, useAmountText } from "@/components/shopping/item-meta";
import { MergeSheet } from "@/components/shopping/merge-sheet";
import { PlanSheet, useShortReason, useSuggestions } from "@/components/shopping/plan-sheet";
import { QuickAddItem } from "@/components/shopping/quick-add-item";
import { AisleIcon } from "@/components/shopping/aisle-icon";
import { rowId, useMergeSheet, useShoppingActions, useShoppingNotice, useSimilarPairs } from "@/components/shopping/shopping-actions";
import { PhotoLight, StoreMode, useSignedPhotos } from "@/components/shopping/store-mode";
import { CheckCircle } from "@/components/ui/check-circle";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressRing } from "@/components/ui/progress-ring";
import { StrikeText } from "@/components/ui/strike-text";
import { SyncCaption, SyncRetry } from "@/components/ui/sync-note";
import { UndoToast } from "@/components/ui/undo-toast";
import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
import { AISLES, knownAisle } from "@/lib/aisles";
import { itemKey, type GroceryHint } from "@/lib/groceries";
import { completionHaptic } from "@/lib/haptics";
import type { ShoppingItem } from "@/lib/household";
import { useAddSheet, useHousehold } from "@/lib/household-store";
import { easeOut, spring } from "@/lib/motion";

const separator =
  "relative after:absolute after:inset-x-0 after:bottom-0 after:ms-[60px] after:h-px after:bg-separator last:after:hidden";

/** Rows arrive and leave by height, and glide when they move between "to buy" and "bought". */
const rowMotion = {
  layout: "position" as const,
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: "auto" },
  exit: { opacity: 0, height: 0 },
  transition: { layout: spring.gentle, default: { duration: 0.24, ease: easeOut } },
};

/** How many suggestions sit under the add field; the rest are a tap away in planning. */
const CHIPS = 5;

function ItemRow({
  item,
  photoUrl,
  onOpenPhoto,
}: {
  item: ShoppingItem;
  photoUrl?: string;
  onOpenPhoto?: (item: ShoppingItem, url: string) => void;
}) {
  const { dict } = useI18n();
  const toggleShoppingItem = useHousehold((s) => s.toggleShoppingItem);
  const showEdit = useAddSheet((s) => s.showEdit);
  const flash = useShoppingNotice((s) => s.flashed[item.id]);
  const bought = item.checkedAt !== null;

  return (
    <div id={rowId(item.id)} className="relative flex min-h-14 scroll-my-24 items-center gap-3 px-4 py-2.5">
      {flash && (
        <motion.span
          key={flash}
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[color-mix(in_oklab,var(--accent)_14%,transparent)]"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: "easeOut", delay: 0.35 }}
        />
      )}
      <motion.button
        type="button"
        onClick={() => {
          if (!bought) completionHaptic();
          toggleShoppingItem(item.id);
        }}
        whileTap={{ scale: 0.88 }}
        transition={spring.snappy}
        aria-pressed={bought}
        aria-label={format(bought ? dict.shopping.unmark : dict.shopping.mark, { name: item.name })}
        className="relative -m-[9px] flex size-11 shrink-0 items-center justify-center rounded-full"
      >
        <CheckCircle checked={bought} color="var(--green)" />
      </motion.button>
      <button
        type="button"
        onClick={() => showEdit({ kind: "shopping", id: item.id })}
        aria-label={format(dict.add.editNamed, { title: item.name })}
        className={`relative flex min-w-0 flex-1 touch-manipulation select-none flex-col text-start transition-opacity duration-200 ${bought ? "opacity-60" : ""}`}
      >
        <StrikeText done={bought}>{item.name}</StrikeText>
        <ItemMeta item={item} />
        <SyncCaption id={item.id} />
      </button>
      <SyncRetry id={item.id} label={item.name} />
      {photoUrl && onOpenPhoto && (
        <button
          type="button"
          onClick={() => onOpenPhoto(item, photoUrl)}
          aria-label={format(dict.shopping.photo, { name: item.name })}
          className={`relative shrink-0 rounded-lg ${bought ? "opacity-60" : ""}`}
        >
          <img src={photoUrl} alt="" className="size-10 rounded-lg object-cover" />
        </button>
      )}
      <Askers item={item} dim={bought} />
    </div>
  );
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/**
 * The home's shopping list: a title that says what's left, the stage with it, one field to add (a sentence
 * of several products works too), a few suggestions, then the list itself, what's left to buy on top and
 * what's already in the cart gathered underneath. Store mode, planning and finishing a trip open from here.
 */
export function ShoppingView() {
  const { dict } = useI18n();
  const { shopping, members, currentUserId, trips, aisleMemory } = useHousehold();
  const actions = useShoppingActions();
  const { notice, dismiss, flash } = useShoppingNotice();
  const openMerge = useMergeSheet((s) => s.open);
  const suggestions = useSuggestions();
  const shortReason = useShortReason();
  const amountText = useAmountText();
  const [store, setStore] = useState(false);
  const [plan, setPlan] = useState(false);
  const [finish, setFinish] = useState(false);
  const [showBought, setShowBought] = useState(true);
  const [photo, setPhoto] = useState<{ url: string; name: string } | null>(null);
  const urls = useSignedPhotos(shopping.flatMap((item) => (item.photoPath ? [item.photoPath] : [])));
  const copy = dict.shopping;

  const toBuy = shopping.filter((item) => !item.checkedAt);
  const bought = shopping
    .filter((item) => item.checkedAt)
    .sort((a, b) => (b.checkedAt ?? "").localeCompare(a.checkedAt ?? ""));
  const onList = new Set(toBuy.map((item) => itemKey(item.name)));
  // Aisles in the order the store walks you through them; an item still being placed waits under "other".
  const groups = AISLES.flatMap((aisle) => {
    const items = toBuy.filter((item) => (item.category ?? "other") === aisle);
    return items.length > 0 ? [{ aisle, items }] : [];
  });
  const pairs = useSimilarPairs(toBuy);

  // What the house has typed or bought before: offered while typing, and trusted when splitting a sentence.
  const pastLines = trips.flatMap((trip) => trip.items);
  const history: GroceryHint[] = [...shopping, ...pastLines].map((line) => ({ name: line.name, note: amountText(line) ?? line.note }));
  const houseNames = new Set([...history.map((hint) => itemKey(hint.name)), ...Object.keys(aisleMemory)]);
  const known = (name: string) => houseNames.has(itemKey(name)) || knownAisle(name) !== null;

  // What the other parent adds lights up as it arrives; the first list on screen is the baseline.
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (shopping.length === 0 && !seen.current) return;
    const known = seen.current;
    seen.current = new Set(shopping.map((item) => item.id));
    if (!known) return;
    for (const item of shopping) if (!known.has(item.id) && item.addedBy !== currentUserId) flash(item.id, false);
  }, [shopping, currentUserId, flash]);

  const title =
    shopping.length === 0
      ? copy.empty
      : toBuy.length === 0
        ? copy.allBought
        : toBuy.length === 1
          ? copy.titleLeftOne
          : format(copy.titleLeft, { count: toBuy.length });
  const eyebrow =
    shopping.length > 0 ? (
      <span className="flex items-center gap-2">
        <ProgressRing value={bought.length / shopping.length} size={18} stroke={2.25} color="var(--green)" />
        {format(copy.inCart, { bought: bought.length, total: shopping.length })}
      </span>
    ) : undefined;

  const openPhoto = (item: ShoppingItem, url: string) => setPhoto({ url, name: item.name });
  const toast = (
    <UndoToast
      toast={notice}
      label={notice?.label ?? ""}
      undoLabel={notice?.action ?? copy.undo}
      onUndo={
        notice?.undo
          ? () => {
              notice.undo?.();
              dismiss();
            }
          : undefined
      }
      onDismiss={dismiss}
    />
  );
  const sheets = (
    <>
      <MergeSheet />
      <FinishSheet open={finish} onOpenChange={setFinish} onFinished={() => setStore(false)} />
      <PlanSheet open={plan} onOpenChange={setPlan} />
      {photo && <PhotoLight url={photo.url} name={photo.name} onClose={() => setPhoto(null)} />}
      {toast}
    </>
  );

  if (store) {
    return (
      <>
        <StoreMode
          items={shopping}
          urls={urls}
          onExit={() => setStore(false)}
          onFinish={() => setFinish(true)}
          onCheck={(id) => {
            completionHaptic();
            actions.checkInStore(id);
          }}
          onUncheck={(id) => useHousehold.getState().toggleShoppingItem(id)}
          onMissing={actions.missing}
          onFound={(id) => useHousehold.getState().setMissing(id, false)}
          onOpenPhoto={openPhoto}
        />
        {sheets}
      </>
    );
  }

  const chips = suggestions.slice(0, CHIPS);

  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} />
      <div className="flex flex-col gap-5">
        <PageStage
          icon={ShoppingBasket}
          tint={["#e9a77f", "#c26a44"]}
          count={toBuy.length}
          compact={toBuy.length > 0}
          chips={toBuy.map((item) => {
            const adder = members.find((member) => member.id === item.addedBy);
            return {
              id: item.id,
              title: item.name,
              note: amountText(item) ?? item.note ?? (adder ? firstName(adder.name) : null),
              visual: (
                <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-[color-mix(in_oklab,var(--green)_14%,var(--surface))] text-green">
                  <ShoppingBasket size={17} strokeWidth={2.1} />
                </span>
              ),
            };
          })}
        />
        <div className="flex flex-col gap-2.5">
          <QuickAddItem history={history} known={known} onList={onList} onAdd={actions.addMany} />
          {chips.length > 0 && (
            <div
              role="group"
              aria-label={copy.suggestions}
              className="-mx-4 flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0 [&::-webkit-scrollbar]:hidden"
            >
              <AnimatePresence initial={false} mode="popLayout">
                {chips.map((suggestion) => {
                  const reason = shortReason(suggestion);
                  return (
                    <motion.button
                      key={suggestion.key}
                      type="button"
                      layout
                      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15, ease: easeOut } }}
                      transition={spring.gentle}
                      onClick={() =>
                        actions.add({ name: suggestion.name, note: suggestion.note, quantity: suggestion.quantity, unit: suggestion.unit })
                      }
                      aria-label={[format(copy.addStaple, { name: suggestion.name }), reason].filter(Boolean).join(", ")}
                      className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-surface ps-3 pe-3.5 text-[15px] font-medium text-label shadow-card ring-1 ring-hairline transition-[scale] duration-150 ease-out active:scale-[0.97]"
                    >
                      <Plus aria-hidden size={15} strokeWidth={2.5} className="text-green" />
                      <span dir="auto">{suggestion.name}</span>
                      {reason && <span className="text-[13px] font-normal text-label-secondary">{reason}</span>}
                    </motion.button>
                  );
                })}
                <motion.button
                  key="more"
                  type="button"
                  layout
                  transition={spring.gentle}
                  onClick={() => setPlan(true)}
                  className="flex min-h-10 shrink-0 items-center rounded-full px-3 text-[15px] font-medium text-accent transition-opacity active:opacity-60"
                >
                  {copy.moreSuggestions}
                </motion.button>
              </AnimatePresence>
            </div>
          )}
        </div>
        <div className="flex gap-2.5">
          {toBuy.length > 0 && (
            <button
              type="button"
              onClick={() => setStore(true)}
              className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-surface text-[17px] font-semibold text-accent shadow-card ring-1 ring-hairline transition-transform duration-150 ease-out active:scale-[0.98]"
            >
              <ShoppingBasket aria-hidden size={18} strokeWidth={2.25} />
              {copy.store}
            </button>
          )}
          <button
            type="button"
            onClick={() => setPlan(true)}
            className={`flex min-h-12 items-center justify-center gap-2 rounded-full bg-surface px-5 text-[17px] font-semibold text-accent shadow-card ring-1 ring-hairline transition-transform duration-150 ease-out active:scale-[0.98] ${toBuy.length > 0 ? "" : "flex-1"}`}
          >
            <ListChecks aria-hidden size={18} strokeWidth={2.25} />
            {copy.plan}
          </button>
        </div>
        <AnimatePresence initial={false}>
          {pairs.length > 0 && (
            <motion.section
              key="similar"
              aria-label={copy.similarTitle}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.24, ease: easeOut }}
              className="overflow-hidden"
            >
              <div className="rounded-card bg-surface shadow-card">
                <p className="px-4 pb-1 pt-3 text-[15px] font-semibold">{copy.similarTitle}</p>
                <ul>
                  <AnimatePresence initial={false}>
                    {pairs.map(([a, b]) => (
                      <motion.li key={`${a.id}-${b.id}`} {...rowMotion} className="overflow-hidden">
                        <div className="flex min-h-12 items-center gap-2 pb-1 pe-2 ps-4">
                          <span dir="auto" className="min-w-0 flex-1 truncate text-[17px]">
                            {a.name} <span className="text-label-tertiary">·</span> {b.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => void actions.keepApart(a, b)}
                            aria-label={format(copy.keepApartNamed, { a: a.name, b: b.name })}
                            className="min-h-11 shrink-0 rounded-full px-3 text-[15px] font-medium text-label-secondary transition-opacity active:opacity-60"
                          >
                            {copy.keepApart}
                          </button>
                          <button
                            type="button"
                            onClick={() => openMerge(a, b)}
                            aria-label={format(copy.mergeNamed, { a: a.name, b: b.name })}
                            className="min-h-9 shrink-0 rounded-full bg-[color-mix(in_oklab,var(--accent)_12%,transparent)] px-3.5 text-[15px] font-semibold text-accent transition-transform duration-150 ease-out active:scale-[0.97]"
                          >
                            {copy.merge}
                          </button>
                        </div>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
        {shopping.length === 0 ? (
          <div className="rounded-card bg-surface shadow-card">
            <EmptyState icon={ShoppingBasket} tint="var(--orange)" title={copy.empty} hint={copy.emptyHint} />
          </div>
        ) : (
          <ul className="overflow-hidden rounded-card bg-surface shadow-card">
            <AnimatePresence initial={false}>
              {groups.flatMap(({ aisle, items }) => [
                <motion.li key={`aisle-${aisle}`} {...rowMotion} className="overflow-hidden">
                  <h2 className="flex min-h-11 items-center gap-2.5 px-4 pb-0.5 pt-3 text-[15px] font-semibold">
                    <AisleIcon aisle={aisle} size={26} />
                    {copy.aisles[aisle]}
                    <span className="font-medium tabular-nums text-label-tertiary">{items.length}</span>
                  </h2>
                </motion.li>,
                ...items.map((item, index) => (
                  <motion.li
                    key={item.id}
                    {...rowMotion}
                    className={`${separator} overflow-hidden ${index === items.length - 1 ? "after:hidden" : ""}`}
                  >
                    <ItemRow item={item} photoUrl={item.photoPath ? urls[item.photoPath] : undefined} onOpenPhoto={openPhoto} />
                  </motion.li>
                )),
              ])}
              {bought.length > 0 && (
                <motion.li
                  key="bought"
                  {...rowMotion}
                  className={`${separator} overflow-hidden bg-[color-mix(in_oklab,var(--fill)_45%,transparent)]`}
                >
                  <div className="flex min-h-12 items-center justify-between gap-3 ps-2 pe-4">
                    <h2 className="section-label">
                      <button
                        type="button"
                        onClick={() => setShowBought((open) => !open)}
                        aria-expanded={showBought}
                        className="flex min-h-11 items-center gap-1.5 rounded-full px-2 text-label-secondary transition-opacity active:opacity-60"
                      >
                        <ChevronDown
                          aria-hidden
                          size={17}
                          strokeWidth={2.4}
                          className={`transition-transform duration-200 ease-out ${showBought ? "" : "-rotate-90 rtl:rotate-90"}`}
                        />
                        {copy.bought}
                        <span className="font-medium tabular-nums text-label-tertiary">{bought.length}</span>
                      </button>
                    </h2>
                    <button
                      type="button"
                      onClick={() => setFinish(true)}
                      className="relative min-h-8 px-1 text-[15px] font-medium text-accent transition-opacity before:absolute before:-inset-x-2 before:-inset-y-1.5 active:opacity-60"
                    >
                      {copy.finish}
                    </button>
                  </div>
                </motion.li>
              )}
              {showBought &&
                bought.map((item) => (
                  <motion.li key={item.id} {...rowMotion} className={`${separator} overflow-hidden`}>
                    <ItemRow item={item} photoUrl={item.photoPath ? urls[item.photoPath] : undefined} onOpenPhoto={openPhoto} />
                  </motion.li>
                ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
      {sheets}
    </>
  );
}
