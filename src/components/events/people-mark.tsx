"use client";

import { Avatar } from "@/components/ui/avatar";
import { useI18n } from "@/i18n/dictionary-provider";
import { firstName } from "@/lib/day-story";
import { useHousehold } from "@/lib/household-store";

/**
 * Who an event is for: one face and a name, or both faces and "both of you". Always written out, so the faces'
 * colors are never the only way to tell.
 */
export function PeopleMark({ people, size = 18 }: { people: string[]; size?: number }) {
  const { dict } = useI18n();
  const members = useHousehold((s) => s.members);
  const shown = members.filter((member) => people.includes(member.id));
  if (shown.length === 0) return null;
  const everyone = members.length > 1 && shown.length === members.length;
  const label = everyone
    ? members.length === 2
      ? dict.agenda.bothOfYou
      : dict.agenda.everyone
    : shown.map((member) => firstName(member.name)).join(", ");

  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span aria-hidden className="flex shrink-0">
        {shown.slice(0, 2).map((member, index) => (
          <span key={member.id} className={`rounded-full ring-2 ring-surface ${index > 0 ? "-ms-1.5" : ""}`}>
            <Avatar member={member} size={size} />
          </span>
        ))}
      </span>
      <span className="sr-only">{dict.events.who}: </span>
      <bdi className="min-w-0 [overflow-wrap:anywhere]">{label}</bdi>
    </span>
  );
}
