"use client";

import { Avatar } from "@/components/ui/avatar";
import { ProgressRing } from "@/components/ui/progress-ring";
import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
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

export function HouseholdMembers({
  members,
  tasks,
  today,
}: {
  members: Member[];
  tasks: Task[];
  today: DayKey | null;
}) {
  const { dict } = useI18n();

  return (
    <section aria-label={dict.today.household}>
      <ul className="flex justify-center gap-6 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {members.map((member) => {
          const load = today ? loadForMember(tasks, member.id, today) : null;
          const caption = load ? captionFor(load, dict.today) : null;
          const ringColor = load && load.open === 0 ? "var(--green)" : member.color;
          return (
            <li key={member.id} className="flex w-[4.75rem] shrink-0 flex-col items-center gap-1.5">
              {load ? (
                <ProgressRing value={load.progress} size={52} stroke={2.5} color={ringColor}>
                  <Avatar member={member} size={40} />
                </ProgressRing>
              ) : (
                <Avatar member={member} size={44} />
              )}
              <div className="min-w-0 max-w-full text-center">
                <p className="truncate text-[13px] font-medium leading-tight">
                  <bdi>{member.name}</bdi>
                </p>
                {caption && (
                  <p className={`truncate text-[12px] leading-snug ${caption.tone}`}>{caption.text}</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
