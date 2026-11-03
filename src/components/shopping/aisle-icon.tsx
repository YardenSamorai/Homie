import {
  Bath,
  Carrot,
  CupSoda,
  Cookie,
  Croissant,
  Drumstick,
  Milk,
  Package,
  Snowflake,
  SprayCan,
  Wheat,
  type LucideIcon,
} from "lucide-react";
import type { Aisle } from "@/lib/aisles";

export const aisleLook: Record<Aisle, { icon: LucideIcon; color: string }> = {
  produce: { icon: Carrot, color: "var(--green)" },
  bakery: { icon: Croissant, color: "var(--orange)" },
  meat: { icon: Drumstick, color: "var(--red)" },
  dairy: { icon: Milk, color: "var(--cyan)" },
  pantry: { icon: Wheat, color: "var(--yellow)" },
  snacks: { icon: Cookie, color: "var(--pink)" },
  drinks: { icon: CupSoda, color: "var(--teal)" },
  frozen: { icon: Snowflake, color: "var(--blue)" },
  cleaning: { icon: SprayCan, color: "var(--mint)" },
  care: { icon: Bath, color: "var(--purple)" },
  other: { icon: Package, color: "var(--brown)" },
};

/** The aisle's mark: its icon on a soft tile of its own color. */
export function AisleIcon({ aisle, size = 28 }: { aisle: Aisle; size?: number }) {
  const { icon: Icon, color } = aisleLook[aisle];
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-[9px]"
      style={{ width: size, height: size, color, background: `color-mix(in oklab, ${color} 14%, var(--surface))` }}
    >
      <Icon size={Math.round(size * 0.58)} strokeWidth={2.1} />
    </span>
  );
}
