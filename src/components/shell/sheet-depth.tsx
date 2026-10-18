"use client";

import { useEffect, useRef } from "react";
import { useAddSheet } from "@/lib/household-store";

/**
 * The page behind the add sheet recedes like an iOS card sheet. The origin is set
 * imperatively, before the open state renders, so the page shrinks around what is
 * on screen rather than around the middle of a long document.
 */
export function SheetDepth({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(
    () =>
      useAddSheet.subscribe((state, prev) => {
        const el = ref.current;
        if (!el || state.open === prev.open) return;
        if (state.open) {
          el.style.transformOrigin = `50% ${window.scrollY - el.offsetTop}px`;
          el.dataset.sheetOpen = "";
        } else {
          delete el.dataset.sheetOpen;
        }
      }),
    [],
  );

  return (
    <main
      ref={ref}
      className={`transition-[transform,border-radius] duration-[450ms] ease-[var(--ease-ios)] data-sheet-open:rounded-[20px] data-sheet-open:[transform:translateY(12px)_scale(0.94)] motion-reduce:data-sheet-open:[transform:none] ${className ?? ""}`}
    >
      {children}
    </main>
  );
}
