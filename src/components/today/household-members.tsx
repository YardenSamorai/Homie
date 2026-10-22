"use client";

import Link from "next/link";
import { Plus, UserPlus } from "lucide-react";
import { openStoriesOf } from "@/components/stories/stories";
import { Avatar } from "@/components/ui/avatar";
import { ProgressRing } from "@/components/ui/progress-ring";
import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
import { pickPhoto, useCameraReady } from "@/lib/camera";
import { seenBy, storiesBy, useStories } from "@/lib/stories-store";
import { supabaseConfigured } from "@/lib/supabase/env";
import { loadForMember, type Member, type Task } from "@/lib/tasks";
import type { DayKey } from "@/lib/dates";

function captionFor(
  load: ReturnType<typeof loadForMember>,
  dict: {
    memberClear: string;
    memberShare: string;
    memberOverdueOne: string;
    memberOverdue: string;
  },
) {
  if (load.total > 0) {
    return {
      text: format(dict.memberShare, { done: load.doneToday, total: load.total }),
      spoken:
        load.overdue > 0
          ? load.overdue === 1
            ? dict.memberOverdueOne
            : format(dict.memberOverdue, { count: load.overdue })
          : format(dict.memberShare, { done: load.doneToday, total: load.total }),
    };
  }
  return { text: dict.memberClear, spoken: dict.memberClear };
}

/**
 * A parent's circle. With status photos it wears the story ring: turning and glowing while there's
 * one this parent hasn't seen, gray once all are seen. Without, the ring shows their tasks for today.
 */
function MemberCircle({ member, self, load }: { member: Member; self: string; load: ReturnType<typeof loadForMember> | null }) {
  const { dict } = useI18n();
  const stories = useStories((s) => s.stories);
  const views = useStories((s) => s.views);
  const setDraft = useStories((s) => s.setDraft);
  const cameraReady = useCameraReady();
  const mine = member.id === self;
  const theirs = storiesBy(stories, member.id);
  const fresh = !mine && theirs.some((story) => !seenBy(views, story.id, self));
  const canPost = mine && supabaseConfigured();

  const capture = async () => {
    if (!cameraReady) return window.alert(dict.stories.update);
    const photo = await pickPhoto({ camera: true });
    if (photo) setDraft(photo);
  };

  const tap = () => {
    if (openStoriesOf(member.id, self)) return;
    if (canPost) void capture();
  };

  const ringColor = load && load.open === 0 ? "var(--green)" : member.color;
  const face =
    theirs.length > 0 ? (
      <span className="relative flex size-12 items-center justify-center">
        <span aria-hidden data-fresh={fresh || undefined} className="story-ring absolute inset-0 rounded-full" />
        <Avatar member={member} size={40} />
      </span>
    ) : load && load.total > 0 ? (
      <ProgressRing value={load.progress} size={48} stroke={2.5} color={ringColor}>
        <Avatar member={member} size={38} />
      </ProgressRing>
    ) : (
      <Avatar member={member} size={44} />
    );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={tap}
        disabled={theirs.length === 0 && !canPost}
        aria-label={theirs.length > 0 ? format(dict.stories.open, { name: member.name }) : canPost ? dict.stories.add : member.name}
        className="block rounded-full transition-transform duration-150 ease-out active:scale-95 disabled:active:scale-100"
      >
        {face}
      </button>
      {canPost && (
        <button
          type="button"
          onClick={() => void capture()}
          aria-label={dict.stories.add}
          className="absolute -bottom-0.5 -end-0.5 flex size-5 items-center justify-center rounded-full bg-accent text-accent-contrast ring-[2.5px] ring-bg transition-transform duration-150 ease-out before:absolute before:-inset-2 active:scale-90"
        >
          <Plus aria-hidden size={14} strokeWidth={2.75} />
        </button>
      )}
    </div>
  );
}

export function HouseholdMembers({
  members,
  self,
  tasks,
  today,
  canInvite,
}: {
  members: Member[];
  self: string;
  tasks: Task[];
  today: DayKey | null;
  /** The other parent hasn't joined yet: an empty seat that opens the invite link. */
  canInvite: boolean;
}) {
  const { locale, dict } = useI18n();

  return (
    <section aria-label={dict.today.household}>
      <ul className="flex flex-wrap items-center gap-x-5 gap-y-3">
        {[...members].sort((a, b) => (a.id === self ? -1 : b.id === self ? 1 : 0)).map((member) => {
          const load = today ? loadForMember(tasks, member.id, today) : null;
          const caption = load ? captionFor(load, dict.today) : null;
          return (
            <li key={member.id} className="flex min-w-0 items-center gap-2.5">
              <MemberCircle member={member} self={self} load={load} />
              <div className="min-w-0 leading-tight">
                <p className="truncate text-[15px] font-semibold">
                  <bdi>{member.name.trim().split(/\s+/)[0]}</bdi>
                </p>
                {caption && (
                  <p className="truncate text-[13px] tabular-nums text-label/60">
                    {caption.text}
                    {caption.spoken !== caption.text && <span className="sr-only">, {caption.spoken}</span>}
                  </p>
                )}
              </div>
            </li>
          );
        })}
        {canInvite && (
          <li className="flex items-center gap-2.5">
            <Link
              href={`/${locale}/setup/invite`}
              aria-label={dict.today.inviteLabel}
              className="flex size-12 items-center justify-center rounded-full border-[1.5px] border-dashed border-label-tertiary text-label-secondary transition-transform duration-150 ease-out active:scale-95"
            >
              <UserPlus aria-hidden size={19} strokeWidth={2} />
            </Link>
            <p aria-hidden className="text-[15px] font-semibold text-label-secondary">
              {dict.today.invite}
            </p>
          </li>
        )}
      </ul>
    </section>
  );
}
