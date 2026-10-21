"use client";

import type { ReactNode } from "react";
import { Menu } from "@base-ui/react/menu";
import { Check, type LucideIcon } from "lucide-react";

export type PickItem = { id: string; label: string; meta?: ReactNode; added: boolean };

/**
 * A pill that opens a short list of ready-made things to add, one tap each (the regular chores, the staples).
 * What's already there shows as added instead of being added twice.
 */
export function PickMenu({
  label,
  icon: Icon,
  heading,
  addedLabel,
  items,
  onPick,
}: {
  label: string;
  icon: LucideIcon;
  heading: string;
  addedLabel: string;
  items: PickItem[];
  onPick: (id: string) => void;
}) {
  return (
    <Menu.Root>
      <Menu.Trigger className="flex min-h-12 shrink-0 items-center gap-2 rounded-full bg-surface ps-4 pe-5 text-[16px] font-semibold text-label shadow-card ring-1 ring-hairline transition-transform duration-150 ease-out active:scale-[0.97] data-popup-open:bg-fill">
        <Icon aria-hidden size={19} strokeWidth={2} className="text-label-secondary" />
        {label}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="start" sideOffset={8} collisionPadding={16} className="z-50">
          <Menu.Popup className="max-h-[min(26rem,var(--available-height))] w-[min(17.5rem,calc(100vw-2rem))] origin-(--transform-origin) overflow-y-auto overscroll-contain rounded-[20px] bg-surface p-1.5 text-label shadow-[0_18px_48px_-12px_rgb(40_30_20/0.28),0_2px_6px_rgb(40_30_20/0.08)] ring-1 ring-hairline outline-none transition-[opacity,scale] duration-150 ease-out data-ending-style:scale-[0.96] data-ending-style:opacity-0 data-starting-style:scale-[0.96] data-starting-style:opacity-0 motion-reduce:transition-opacity motion-reduce:data-ending-style:scale-100 motion-reduce:data-starting-style:scale-100">
            <p className="px-3 pb-1 pt-2 text-[13px] font-semibold text-label-secondary">{heading}</p>
            {items.map((item) => (
              <Menu.Item
                key={item.id}
                disabled={item.added}
                onClick={() => onPick(item.id)}
                className="flex min-h-12 cursor-default select-none items-center gap-3 rounded-[14px] px-3 text-[16px] outline-none data-disabled:opacity-60 data-highlighted:bg-fill"
              >
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.added ? (
                  <span className="flex shrink-0 items-center gap-1 text-[13px] font-medium text-green">
                    <Check aria-hidden size={15} strokeWidth={2.5} />
                    {addedLabel}
                  </span>
                ) : (
                  item.meta && <span className="flex shrink-0 items-center gap-1 text-[13px] text-label-secondary">{item.meta}</span>
                )}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
