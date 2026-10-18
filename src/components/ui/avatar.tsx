import type { Member } from "@/lib/tasks";

export function Avatar({ member, size = 56 }: { member: Member; size?: number }) {
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        backgroundImage: `radial-gradient(circle at 32% 24%, rgb(255 255 255 / 0.42), transparent 46%), linear-gradient(160deg, color-mix(in oklab, ${member.color} 70%, white), ${member.color})`,
        boxShadow: `inset 0 -${size * 0.06}px ${size * 0.12}px rgb(0 0 0 / 0.14), inset 0 0 0 0.5px rgb(255 255 255 / 0.25), 0 ${size * 0.08}px ${size * 0.2}px color-mix(in oklab, ${member.color} 35%, transparent)`,
      }}
      className="flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white [text-shadow:0_1px_1px_rgb(0_0_0/0.15)]"
    >
      {Array.from(member.name)[0]}
    </span>
  );
}
