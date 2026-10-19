"use client";

import { Avatar } from "@/components/ui/avatar";
import { useHousehold } from "@/lib/household-store";

export function HouseholdCard() {
  const members = useHousehold((s) => s.members);
  const seeded = useHousehold((s) => s.seeded);
  if (!seeded) return <div aria-hidden className="h-14" />;

  return (
    <ul>
      {members.map((member, index) => (
        <li
          key={member.id}
          className={`flex min-h-14 items-center gap-3 px-4 ${
            index < members.length - 1 ? "border-b border-separator" : ""
          }`}
        >
          <Avatar member={member} size={36} />
          <span className="min-w-0 truncate text-[17px]">
            <bdi>{member.name}</bdi>
          </span>
        </li>
      ))}
    </ul>
  );
}
