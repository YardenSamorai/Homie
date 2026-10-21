"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Eye, Trash2, X } from "lucide-react";
import { useAgo } from "@/components/shell/activity";
import { Avatar } from "@/components/ui/avatar";
import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
import { useAuth, useAuthReady } from "@/lib/auth/session";
import { useHousehold } from "@/lib/household-store";
import { easeOut } from "@/lib/motion";
import { onReturn } from "@/lib/on-return";
import { firstUnseen, seenBy, storiesBy, useStories } from "@/lib/stories-store";
import { supabaseConfigured } from "@/lib/supabase/env";
import {
  clearExpiredStories,
  compressImage,
  deleteStory,
  loadStories,
  markStorySeen,
  postStory,
  signedUrls,
  watchStories,
  type Story,
} from "@/lib/supabase/media";
import type { Member } from "@/lib/tasks";

const STORY_MS = 5000;

/** Keeps the house's status photos live. Mounted once in the app layout. */
export function StorySync() {
  const ready = useAuthReady();
  const userId = useAuth((s) => s.session?.userId);
  const householdId = useAuth((s) => s.session?.householdId);
  const replace = useStories((s) => s.replace);
  const clear = useStories((s) => s.clear);

  useEffect(() => {
    if (!ready || !userId || !householdId || !supabaseConfigured()) {
      clear();
      return;
    }
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        const { stories, views } = await loadStories();
        const urls = await signedUrls(stories.map((story) => story.path));
        if (alive) replace(stories, views, urls);
      } catch {
        // Offline: keep what's showing.
      }
    };
    const soon = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void load(), 150);
    };
    void clearExpiredStories(userId).catch(() => {});
    void load();
    const stopWatching = watchStories(householdId, soon);
    const stopReturn = onReturn(soon);
    // A photo past its 24 hours leaves the ring even if nothing else changes.
    const tick = setInterval(soon, 5 * 60_000);
    return () => {
      alive = false;
      clearTimeout(timer);
      clearInterval(tick);
      stopWatching();
      stopReturn();
    };
  }, [ready, userId, householdId, replace, clear]);

  return null;
}

/** Freezes the page under a full-screen layer, the way a native modal does. */
function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previous;
    };
  }, [active]);
}

/** The photo just taken, a caption, Share. */
export function StoryComposer() {
  const { dict } = useI18n();
  const draft = useStories((s) => s.draft);
  const setDraft = useStories((s) => s.setDraft);
  const addStory = useStories((s) => s.addStory);
  const userId = useAuth((s) => s.session?.userId);
  const householdId = useAuth((s) => s.session?.householdId);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const preview = useMemo(() => (draft ? URL.createObjectURL(draft) : null), [draft]);
  useScrollLock(Boolean(draft));

  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  const close = () => {
    setDraft(null);
    setCaption("");
    setFailed(false);
  };

  const share = async () => {
    if (!draft || !userId || !householdId) return;
    setBusy(true);
    setFailed(false);
    try {
      const photo = await compressImage(draft, { side: 1440 });
      const story = await postStory({ householdId, userId, photo, caption });
      const url = (await signedUrls([story.path]))[story.path];
      addStory(story, url);
      close();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {draft && preview && (
        <motion.div
          key="composer"
          role="dialog"
          aria-modal
          aria-label={dict.stories.add}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: easeOut }}
          className="fixed inset-0 z-[70] flex flex-col bg-black text-white"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- a local preview of a photo that hasn't been uploaded. */}
          <img src={preview} alt="" className="absolute inset-0 size-full object-contain" />
          <div className="relative flex items-center justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <button
              type="button"
              onClick={close}
              aria-label={dict.stories.cancel}
              className="flex size-11 items-center justify-center rounded-full bg-black/35 backdrop-blur-md active:scale-95"
            >
              <X aria-hidden size={22} />
            </button>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void share();
            }}
            className="relative mt-auto flex flex-col gap-3 bg-gradient-to-t from-black/70 to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-16"
          >
            {failed && <p className="text-center text-[15px] font-medium text-white">{dict.stories.failed}</p>}
            <div className="flex items-center gap-2">
              <input
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                maxLength={120}
                dir="auto"
                enterKeyHint="send"
                placeholder={dict.stories.captionPlaceholder}
                aria-label={dict.stories.captionPlaceholder}
                style={{ outline: "none" }}
                className="h-12 min-w-0 flex-1 rounded-full bg-white/15 px-5 text-[16px] text-white ring-1 ring-white/25 backdrop-blur-md placeholder:text-white/60 focus:ring-2 focus:ring-white/60"
              />
              <button
                type="submit"
                disabled={busy}
                className="h-12 shrink-0 rounded-full bg-white px-6 text-[16px] font-semibold text-black transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-70"
              >
                {busy ? dict.stories.sharing : dict.stories.share}
              </button>
            </div>
          </form>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** Full screen, one photo at a time: tap the far side for the next, the near side to go back, hold to pause, pull down to close. */
export function StoryViewer() {
  const viewing = useStories((s) => s.viewing);
  useScrollLock(Boolean(viewing));
  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>{viewing && <ViewerBody key={viewing.authorId} authorId={viewing.authorId} />}</AnimatePresence>,
    document.body,
  );
}

function ViewerBody({ authorId }: { authorId: string }) {
  const { locale, dict } = useI18n();
  const { stories, urls, viewing, goTo, close } = useStories();
  const members = useHousehold((s) => s.members);
  const own = storiesBy(stories, authorId);
  const index = Math.min(viewing?.index ?? 0, Math.max(own.length - 1, 0));
  const story = own[index];
  const author = members.find((member) => member.id === authorId);
  const [drag, setDrag] = useState(0);

  const next = () => (index + 1 < own.length ? goTo(index + 1) : close());
  const previous = () => goTo(Math.max(0, index - 1));
  const rtl = locale === "he";

  useEffect(() => {
    if (!story) close();
  }, [story, close]);

  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === (rtl ? "ArrowLeft" : "ArrowRight")) next();
      if (event.key === (rtl ? "ArrowRight" : "ArrowLeft")) previous();
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  });

  // Preload the next photo so tapping through never waits.
  const upcoming = own[index + 1] ? urls[own[index + 1].path] : undefined;
  useEffect(() => {
    if (!upcoming) return;
    const image = new Image();
    image.src = upcoming;
  }, [upcoming]);

  if (!story || !author) return null;

  return (
    <motion.div
      role="dialog"
      aria-modal
      aria-label={format(dict.stories.open, { name: author.name })}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1 - drag / 600, scale: 1 - drag / 3000, y: drag }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={drag ? { duration: 0 } : { duration: 0.22, ease: easeOut }}
      className="fixed inset-0 z-[70] flex flex-col overflow-hidden bg-black text-white"
    >
      <Slide
        key={story.id}
        story={story}
        author={author}
        all={own}
        index={index}
        rtl={rtl}
        onNext={next}
        onPrevious={previous}
        onDrag={setDrag}
      />
    </motion.div>
  );
}

/** One photo: its own progress, loading and delete state, so the next photo always starts fresh. */
function Slide({
  story,
  author,
  all,
  index,
  rtl,
  onNext,
  onPrevious,
  onDrag,
}: {
  story: Story;
  author: Member;
  all: Story[];
  index: number;
  rtl: boolean;
  onNext: () => void;
  onPrevious: () => void;
  onDrag: (pixels: number) => void;
}) {
  const { dict } = useI18n();
  const ago = useAgo();
  const { views, urls, close, removeStory, addView } = useStories();
  const members = useHousehold((s) => s.members);
  const selfId = useHousehold((s) => s.currentUserId);
  const partner = members.find((member) => member.id !== selfId);
  const mine = story.authorId === selfId;
  const url = urls[story.path];

  const [progress, setProgress] = useState(0);
  const [held, setHeld] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const press = useRef<{ x: number; y: number; at: number } | null>(null);
  const advance = useEffectEvent(onNext);

  useEffect(() => {
    if (mine || seenBy(useStories.getState().views, story.id, selfId)) return;
    addView({ storyId: story.id, viewerId: selfId, viewedAt: new Date().toISOString() });
    void markStorySeen(story.id, selfId).catch(() => {});
  }, [story.id, mine, selfId, addView]);

  useEffect(() => {
    if (!loaded || held || confirming) return;
    let frame = 0;
    let last = performance.now();
    let value = progress;
    const step = (now: number) => {
      value += (now - last) / STORY_MS;
      last = now;
      if (value >= 1) {
        setProgress(1);
        advance();
        return;
      }
      setProgress(value);
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
    // Resuming after a pause continues from where the bar stopped, not from zero.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, held, confirming]);

  const down = (event: PointerEvent) => {
    press.current = { x: event.clientX, y: event.clientY, at: performance.now() };
    setHeld(true);
  };
  const move = (event: PointerEvent) => {
    if (press.current) onDrag(Math.max(0, event.clientY - press.current.y));
  };
  const up = (event: PointerEvent) => {
    const start = press.current;
    press.current = null;
    setHeld(false);
    onDrag(0);
    if (!start) return;
    const pulled = event.clientY - start.y;
    if (pulled > 110) return close();
    if (performance.now() - start.at > 250 || Math.abs(pulled) > 12) return;
    const onRight = event.clientX > event.currentTarget.getBoundingClientRect().width / 2;
    // The far side is forward: the left in Hebrew, the right in English.
    if (onRight !== rtl) onNext();
    else onPrevious();
  };
  const cancel = () => {
    press.current = null;
    setHeld(false);
    onDrag(0);
  };

  const remove = async () => {
    if (!confirming) return setConfirming(true);
    removeStory(story.id);
    await deleteStory(story).catch(() => {});
  };

  const seen = partner ? seenBy(views, story.id, partner.id) : false;

  return (
    <>
      <div className="absolute inset-0 touch-none select-none" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel}>
        {url && (
          // eslint-disable-next-line @next/next/no-img-element -- a signed, expiring link to a private photo.
          <img
            src={url}
            alt={story.caption ?? ""}
            draggable={false}
            onLoad={() => setLoaded(true)}
            className={`size-full object-contain transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"}`}
          />
        )}
        {!loaded && <div aria-hidden className="absolute inset-0 m-auto size-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
      </div>

      <div className="pointer-events-none relative bg-gradient-to-b from-black/55 to-transparent px-3 pb-8 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="flex gap-1" aria-hidden>
          {all.map((item, position) => (
            <span key={item.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/35">
              <span
                className="block h-full rounded-full bg-white"
                style={{ width: `${(position < index ? 1 : position === index ? progress : 0) * 100}%` }}
              />
            </span>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2.5">
          <Avatar member={author} size={34} />
          <p className="min-w-0 flex-1 truncate text-[15px] font-semibold">
            <bdi>{author.name}</bdi>
            <span className="ms-2 font-normal text-white/70">{ago(story.createdAt)}</span>
          </p>
          <button
            type="button"
            onClick={close}
            aria-label={dict.stories.close}
            className="pointer-events-auto flex size-11 items-center justify-center rounded-full active:scale-95"
          >
            <X aria-hidden size={24} />
          </button>
        </div>
      </div>

      <div className="pointer-events-none relative mt-auto flex flex-col items-center gap-3 bg-gradient-to-t from-black/60 to-transparent px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-16">
        {story.caption && (
          <p dir="auto" className="max-w-md text-center text-[17px] font-medium leading-snug [text-shadow:0_1px_8px_rgb(0_0_0/0.5)]">
            {story.caption}
          </p>
        )}
        {mine && (
          <div className="flex w-full items-center justify-between">
            <p className="flex items-center gap-1.5 text-[14px] text-white/85">
              <Eye aria-hidden size={16} />
              {seen && partner ? format(dict.stories.seenBy, { name: partner.name }) : dict.stories.notSeen}
            </p>
            <button
              type="button"
              onClick={() => void remove()}
              className="pointer-events-auto flex min-h-11 items-center gap-1.5 rounded-full px-3 text-[14px] font-semibold active:scale-95"
            >
              <Trash2 aria-hidden size={17} />
              {confirming ? dict.stories.deleteConfirm : dict.stories.delete}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

/** Where tapping a parent's circle starts: their first photo this parent hasn't seen. */
export function openStoriesOf(authorId: string, viewerId: string) {
  const { stories, views, open } = useStories.getState();
  const own = storiesBy(stories, authorId);
  if (own.length === 0) return false;
  open(authorId, authorId === viewerId ? 0 : firstUnseen(own, views, viewerId));
  return true;
}
