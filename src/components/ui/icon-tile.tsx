import type { LucideIcon } from "lucide-react";

/** iOS Settings-style glyph: white icon on a rounded square of a system color. */
export function IconTile({ icon: Icon, color }: { icon: LucideIcon; color: string }) {
  return (
    <span
      aria-hidden
      style={{ backgroundColor: color }}
      className="flex size-[30px] shrink-0 items-center justify-center rounded-[8px] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.28)]"
    >
      <Icon size={18} strokeWidth={2.25} />
    </span>
  );
}
