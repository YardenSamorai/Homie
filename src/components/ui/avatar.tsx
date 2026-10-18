import type { Member } from "@/lib/tasks";

/** A flat monogram in the member's color, lit softly from above like the house in the hero. */
export function Avatar({ member, size = 56 }: { member: Member; size?: number }) {
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        backgroundImage: `linear-gradient(to bottom, color-mix(in oklab, ${member.color} 86%, white), ${member.color})`,
      }}
      className="flex shrink-0 select-none items-center justify-center rounded-full font-medium text-white"
    >
      {Array.from(member.name)[0]}
    </span>
  );
}
