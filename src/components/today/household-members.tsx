"use client";

import { Plus } from "lucide-react";
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
    memberOpenOne: string;
    memberOpen: string;
    memberOverdueOne: string;
    memberOverdue: string;
  },
) {
  if (load.overdue > 0) {
    return {
      text: load.overdue === 1 ? dict.memberOverdueOne : format(dict.memberOverdue, { count: load.overdue }),
      tone: "text-danger" as const,
    };
  }
  if (load.open > 0) {
    return {
      text: load.open === 1 ? dict.memberOpenOne : format(dict.memberOpen, { count: load.open }),
      tone: "text-label-secondary" as const,
    };
  }
  return { text: dict.memberClear, tone: "text-label-secondary" as const };
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
      <span data-fresh={fresh || undefined} data-seen={!fresh && !mine ? "" : undefined} className="story-ring flex size-[52px] items-center justify-center rounded-full">
        <span className="flex size-[48px] items-center justify-center rounded-full bg-bg">
          <Avatar member={member} size={42} />
        </span>
      </span>
    ) : load ? (
      <ProgressRing value={load.progress} size={52} stroke={2.5} color={ringColor}>
        <Avatar member={member} size={40} />
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
          className="absolute -bottom-0.5 -end-0.5 flex size-[22px] items-center justify-center rounded-full bg-accent text-accent-contrast ring-[2.5px] ring-bg transition-transform duration-150 ease-out before:absolute before:-inset-2 active:scale-90"
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
}: {
  members: Member[];
  self: string;
  tasks: Task[];
  today: DayKey | null;
}) {
  const { dict } = useI18n();

  return (
    <section aria-label={dict.today.household}>
      <ul className="flex justify-center gap-3 overflow-x-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {members.map((member) => {
          const load = today ? loadForMember(tasks, member.id, today) : null;
          const caption = load ? captionFor(load, dict.today) : null;
          return (
            <li key={member.id} className="flex w-[6rem] shrink-0 flex-col items-center gap-1.5">
              <MemberCircle member={member} self={self} load={load} />
              <div className="min-w-0 max-w-full text-center">
                <p className="truncate text-[13px] font-medium leading-tight">
                  <bdi>{member.name.trim().split(/\s+/)[0]}</bdi>
                </p>
                {caption && (
                  <p className={`line-clamp-2 text-balance text-[12px] leading-snug ${caption.tone}`}>{caption.text}</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
