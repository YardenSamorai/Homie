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
    <section aria-labelledby="household-title" className="flex flex-col gap-2">
      <h2 id="household-title" className="section-label px-1 text-label-secondary">
        {dict.today.household}
      </h2>
      <ul className="grid grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))] overflow-hidden rounded-card bg-surface shadow-card ring-1 ring-[light-dark(rgb(40_30_20/0.04),rgb(255_255_255/0.06))]">
        {members.map((member, index) => {
          const load = today ? loadForMember(tasks, member.id, today) : null;
          const caption = load ? captionFor(load, dict.today) : null;
          const ringColor = load && load.open === 0 ? "var(--green)" : member.color;
          return (
            <li
              key={member.id}
              className={`flex items-center gap-3 px-4 py-3.5 ${
                members.length > 1 && index === 0 ? "border-e border-separator" : ""
              }`}
            >
              {load ? (
                <ProgressRing value={load.progress} size={48} stroke={2.75} color={ringColor}>
                  <Avatar member={member} size={38} />
                </ProgressRing>
              ) : (
                <Avatar member={member} size={44} />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[17px] font-medium leading-tight">
                  <bdi>{member.name}</bdi>
                </p>
                {caption && (
                  <p className={`mt-0.5 truncate text-[13px] ${caption.tone}`}>{caption.text}</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
