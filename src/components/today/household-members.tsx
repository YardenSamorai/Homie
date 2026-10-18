"use client";

import { Avatar } from "@/components/ui/avatar";
import { useI18n } from "@/i18n/dictionary-provider";
import type { Member } from "@/lib/tasks";

export function HouseholdMembers({ members }: { members: Member[] }) {
  const { dict } = useI18n();

  return (
    <section aria-labelledby="household-title" className="flex flex-col gap-3">
      <h2 id="household-title" className="section-label px-1 text-label-secondary">
        {dict.today.household}
      </h2>
      <ul className="flex gap-5 px-1">
        {members.map((member) => (
          <li key={member.id} className="flex w-16 flex-col items-center gap-1.5">
            <Avatar member={member} size={56} />
            <span className="max-w-full truncate text-[13px] font-medium">{member.name}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
