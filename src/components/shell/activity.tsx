"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Drawer } from "@base-ui/react/drawer";
import { AnimatePresence, motion, useAnimationControls } from "motion/react";
import { Bell, BellRing } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
import { activityLine, activityPath, type ActivityItem } from "@/lib/activity";
import { isUnread, unreadCount, useActivity } from "@/lib/activity-store";
import { useAuth, useAuthReady } from "@/lib/auth/session";
import { MEMBER_COLORS, useHousehold } from "@/lib/household-store";
import { spring } from "@/lib/motion";
import { isNativeApp, setAppBadge } from "@/lib/native";
import { onReturn } from "@/lib/on-return";
import { enablePush, followNotificationTaps, openAppSettings, pushState, refreshPush, type PushState } from "@/lib/push/client";
import { loadActivity, watchActivity } from "@/lib/supabase/activity";
import { supabaseConfigured } from "@/lib/supabase/env";

/** Keeps the bell's feed live and this iPhone registered for notifications. Mounted once in the app layout. */
export function ActivitySync() {
  const { locale } = useI18n();
  const ready = useAuthReady();
  const userId = useAuth((s) => s.session?.userId);
  const householdId = useAuth((s) => s.session?.householdId);
  const replace = useActivity((s) => s.replace);
  const add = useActivity((s) => s.add);
  const clear = useActivity((s) => s.clear);

  useEffect(() => {
    if (!ready || !userId || !householdId || !supabaseConfigured()) {
      clear();
      return;
    }
    let alive = true;
    const load = () => {
      loadActivity(householdId, userId)
        .then(({ items, seenAt }) => alive && replace(items, seenAt))
        .catch(() => {});
    };
    load();
    const stopWatching = watchActivity(householdId, { onItem: add, onReconnect: load });
    const stopReturn = onReturn(load);
    return () => {
      alive = false;
      stopWatching();
      stopReturn();
    };
  }, [ready, userId, householdId, replace, add, clear]);

  useEffect(() => {
    if (!householdId) return;
    void refreshPush(locale);
    return followNotificationTaps();
  }, [householdId, locale]);

  // The icon's number follows the bell: what the other parent did since this one last looked.
  const selfId = useHousehold((s) => s.currentUserId);
  const unread = useActivity((s) => unreadCount(s.items, s.seenAt, selfId));
  useEffect(() => {
    if (ready && userId) setAppBadge(unread);
  }, [ready, userId, unread]);

  return null;
}

/** The bell in the top corner of Today and of every page title. */
export function ActivityBell({ glass = false }: { glass?: boolean }) {
  const { dict } = useI18n();
  const selfId = useHousehold((s) => s.currentUserId);
  const items = useActivity((s) => s.items);
  const seenAt = useActivity((s) => s.seenAt);
  const show = useActivity((s) => s.show);
  const count = unreadCount(items, seenAt, selfId);
  const ring = useAnimationControls();
  const previous = useRef(count);

  useEffect(() => {
    // A small swing when something new arrives, the way a bell would; reduced motion skips it.
    if (count > previous.current) void ring.start({ rotate: [0, -16, 12, -7, 3, 0], transition: { duration: 0.7, ease: "easeInOut" } });
    previous.current = count;
  }, [count, ring]);

  const Icon = count > 0 ? BellRing : Bell;

  return (
    <button
      type="button"
      onClick={() => show(selfId)}
      aria-label={count > 0 ? format(dict.activity.openUnread, { count }) : dict.activity.open}
      className={`relative flex size-11 shrink-0 items-center justify-center rounded-full text-label transition-[scale,background-color] duration-150 ease-out active:scale-95 ${
        glass
          ? "bg-white/55 backdrop-blur-xl"
          : "bg-surface shadow-card ring-1 ring-[light-dark(rgb(40_30_20/0.05),rgb(255_255_255/0.08))]"
      }`}
    >
      <motion.span animate={ring} style={{ originY: 0.15 }} className="flex">
        <Icon aria-hidden size={20} strokeWidth={1.75} />
      </motion.span>
      <AnimatePresence>
        {count > 0 && (
          <motion.span
            key="badge"
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.4, opacity: 0 }}
            transition={spring.pop}
            className="absolute -end-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[11px] font-semibold leading-none text-white tabular-nums ring-2 ring-bg"
          >
            {count > 9 ? "9+" : count}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

export function useAgo() {
  const { locale } = useI18n();
  const rtf = useMemo(() => new Intl.RelativeTimeFormat(locale === "he" ? "he-IL" : "en-US", { numeric: "auto" }), [locale]);
  // Hebrew data repeats the count after singular and dual forms: "לפני שעתיים (2)".
  const say = (value: number, unit: Intl.RelativeTimeFormatUnit) => rtf.format(value, unit).replace(/\s\(\d+\)$/, "");
  return (iso: string) => {
    const minutes = Math.round((Date.parse(iso) - Date.now()) / 60_000);
    if (minutes > -1) return say(0, "second");
    if (minutes > -60) return say(minutes, "minute");
    if (minutes > -24 * 60) return say(Math.round(minutes / 60), "hour");
    return say(Math.round(minutes / 1440), "day");
  };
}

/**
 * Only in the iPhone app, from a tap. In the bell it appears until notifications are on;
 * in Settings (`always`) it stays, saying they're on.
 */
export function PushControl({ always = false }: { always?: boolean }) {
  const { locale, dict } = useI18n();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    const check = () => void pushState().then((next) => live && setState(next)).catch(() => {});
    check();
    // Back from the iPhone's Settings with notifications turned on.
    const stop = onReturn(check);
    return () => {
      live = false;
      stop();
    };
  }, []);

  if (state === null || state === "unsupported" || (state === "on" && !always)) return null;

  const turnOn = async () => {
    setBusy(true);
    setFailed(false);
    try {
      setState(await enablePush(locale));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const copy = dict.activity.push;
  const message = failed
    ? copy.failed
    : { prompt: copy.body, denied: copy.denied, outdated: copy.outdated, on: copy.on }[state];
  const action = state === "denied" ? copy.settings : state === "prompt" ? copy.enable : null;

  return (
    <div className={`flex items-center gap-3 rounded-[20px] p-4 ${always ? "" : "mx-4 mb-4 bg-fill"}`}>
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-full shadow-card ${state === "on" ? "bg-accent text-accent-contrast" : "bg-surface text-accent"}`}>
        <BellRing aria-hidden size={19} strokeWidth={1.9} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold">{copy.title}</p>
        <p className="mt-0.5 text-[13px] leading-snug text-label-secondary">{message}</p>
      </div>
      {action && (
        <button
          type="button"
          disabled={busy}
          onClick={() => (state === "denied" ? openAppSettings() : void turnOn())}
          className="min-h-10 shrink-0 rounded-full bg-accent px-4 text-[14px] font-semibold text-accent-contrast transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-60"
        >
          {action}
        </button>
      )}
    </div>
  );
}

function ActivityRow({ item, fresh, onOpen }: { item: ActivityItem; fresh: boolean; onOpen: () => void }) {
  const { dict } = useI18n();
  const members = useHousehold((s) => s.members);
  const selfId = useHousehold((s) => s.currentUserId);
  const ago = useAgo();
  const member = members.find((m) => m.id === item.actorId) ?? { id: item.actorId, name: "?", color: MEMBER_COLORS[1] };

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-3 px-4 py-3 text-start transition-colors duration-150 active:bg-fill"
      >
        <Avatar member={member} size={40} />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] leading-snug">
            <span className="font-semibold">
              <bdi>{member.name}</bdi>
            </span>
            <span className="text-label-secondary"> · </span>
            <bdi>{activityLine(dict.activity.kinds, item.kind, item.title, item.actorId === selfId)}</bdi>
          </span>
          <span className="mt-0.5 block text-[13px] text-label-secondary">{ago(item.createdAt)}</span>
        </span>
        {fresh && <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-accent" />}
      </button>
    </li>
  );
}

const subscribeNever = () => () => {};

/** Settings: where notifications stand on this iPhone. Nothing on the site, which gets none. */
export function NotificationsCard() {
  const { dict } = useI18n();
  const native = useSyncExternalStore(subscribeNever, isNativeApp, () => false);
  if (!native) return null;
  return (
    <Card title={dict.activity.push.settingsTitle}>
      <PushControl always />
    </Card>
  );
}

/** What the other parent has been doing, newest first. Opening it marks everything as seen. */
export function ActivitySheet() {
  const { locale, dict } = useI18n();
  const router = useRouter();
  const selfId = useHousehold((s) => s.currentUserId);
  const { items, seenBefore, open, show, hide } = useActivity();

  const go = (item: ActivityItem) => {
    hide();
    router.push(activityPath(locale, item.kind));
  };

  return (
    <Drawer.Root open={open} onOpenChange={(next) => (next ? show(selfId) : hide())}>
      <Drawer.Portal>
        <Drawer.Backdrop className="fixed inset-0 z-50 min-h-dvh bg-black opacity-[calc(0.3*(1-var(--drawer-swipe-progress)))] transition-opacity duration-[450ms] ease-[var(--ease-ios)] data-swiping:duration-0 data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)]" />
        <Drawer.Viewport className="fixed inset-0 z-50 flex touch-none items-end justify-center">
          <Drawer.Popup className="flex max-h-[calc(100dvh-3rem)] min-h-[50dvh] w-full max-w-lg touch-none flex-col rounded-t-[28px] bg-sheet text-label shadow-[0_-8px_40px_rgb(40_30_20/0.16)] outline-none [transform:translateY(var(--drawer-swipe-movement-y))] transition-transform duration-[450ms] ease-[var(--ease-ios)] will-change-transform data-swiping:select-none data-starting-style:[transform:translateY(100%)] data-ending-style:[transform:translateY(100%)] data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] motion-reduce:transition-opacity motion-reduce:data-starting-style:[transform:none] motion-reduce:data-starting-style:opacity-0 motion-reduce:data-ending-style:[transform:none] motion-reduce:data-ending-style:opacity-0">
            <div aria-hidden className="mx-auto mb-1 mt-2 h-[5px] w-9 shrink-0 rounded-full bg-label-tertiary" />
            <div className="flex shrink-0 items-center justify-between px-4 pb-3 pt-1">
              <Drawer.Title className="text-[20px] font-bold tracking-tight">{dict.activity.title}</Drawer.Title>
              <Drawer.Close className="py-2 text-[17px] font-semibold text-accent">{dict.activity.close}</Drawer.Close>
            </div>
            <Drawer.Content className="flex min-h-0 flex-1 touch-auto flex-col overflow-y-auto overscroll-contain pb-[max(env(safe-area-inset-bottom),20px)]">
              <PushControl />
              {items.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 px-10 py-12 text-center">
                  <span className="flex size-14 items-center justify-center rounded-full bg-fill text-accent">
                    <Bell aria-hidden size={24} strokeWidth={1.75} />
                  </span>
                  <p className="text-[15px] leading-snug text-label-secondary">{dict.activity.empty}</p>
                </div>
              ) : (
                <ul className="divide-y divide-separator">
                  {items.map((item) => (
                    <ActivityRow key={item.id} item={item} fresh={isUnread(item, seenBefore, selfId)} onOpen={() => go(item)} />
                  ))}
                </ul>
              )}
            </Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
