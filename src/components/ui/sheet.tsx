"use client";

import { Drawer } from "@base-ui/react/drawer";
import type { ReactNode } from "react";

/** The app's bottom sheet: slides up, follows the keyboard, closes with a swipe down. */
export function Sheet({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: ReactNode }) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.VirtualKeyboardProvider>
        <Drawer.Portal>
          <Drawer.Backdrop className="fixed inset-0 z-50 min-h-dvh bg-black opacity-[calc(0.3*(1-var(--drawer-swipe-progress)))] transition-opacity duration-[450ms] ease-[var(--ease-ios)] data-swiping:duration-0 data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)]" />
          <Drawer.Viewport className="fixed inset-0 z-50 flex touch-none items-end justify-center">
            <Drawer.Popup
              data-keyboard-aware
              className="relative flex max-h-[calc(100dvh_-_3rem_-_var(--keyboard))] min-h-[min(60dvh,calc(100dvh_-_3rem_-_var(--keyboard)))] w-full max-w-lg touch-none flex-col rounded-t-[28px] bg-sheet text-label shadow-[0_-8px_40px_rgb(40_30_20/0.16)] outline-none [transform:translateY(calc(var(--drawer-swipe-movement-y,0px)_-_var(--keyboard)))] transition-[transform,min-height,max-height] duration-[450ms] after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-dvh after:bg-sheet ease-[var(--ease-ios)] will-change-transform data-swiping:select-none data-starting-style:[transform:translateY(100%)] data-ending-style:[transform:translateY(100%)] data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] motion-reduce:transition-opacity motion-reduce:data-starting-style:[transform:none] motion-reduce:data-starting-style:opacity-0 motion-reduce:data-ending-style:[transform:none] motion-reduce:data-ending-style:opacity-0"
            >
              <div aria-hidden className="mx-auto mb-1 mt-2 h-[5px] w-9 shrink-0 rounded-full bg-label-tertiary" />
              {children}
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.VirtualKeyboardProvider>
    </Drawer.Root>
  );
}

/** Cancel on the start side, the title in the middle, the sheet's one action on the end side. */
export function SheetHeader({
  title,
  cancel,
  action,
}: {
  title: string;
  cancel: string;
  action?: { label: string; onClick?: () => void; disabled?: boolean; submit?: boolean };
}) {
  return (
    <div className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-x-3 px-4 pb-3 pt-1">
      <Drawer.Close className="justify-self-start py-2 text-[17px] text-accent">{cancel}</Drawer.Close>
      <Drawer.Title className="max-w-[55vw] truncate text-[17px] font-semibold">{title}</Drawer.Title>
      {action ? (
        <button
          type={action.submit ? "submit" : "button"}
          onClick={action.onClick}
          disabled={action.disabled}
          className="justify-self-end py-2 text-[17px] font-semibold text-accent transition-opacity duration-150 disabled:opacity-35"
        >
          {action.label}
        </button>
      ) : (
        <span />
      )}
    </div>
  );
}

export function SheetBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <Drawer.Content
      className={`flex min-h-0 flex-1 touch-auto flex-col gap-5 overflow-y-auto overscroll-contain px-4 pb-[max(var(--safe-bottom),20px)] ${className}`}
    >
      {children}
    </Drawer.Content>
  );
}

/** A grouped list inside a sheet, iOS settings style. */
export const sheetGroup = "overflow-hidden rounded-xl bg-surface divide-y divide-separator";
