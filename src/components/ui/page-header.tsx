"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

const subscribeNever = () => () => {};

/** iOS large title: once it scrolls under the top edge, a compact copy fades in so the screen stays named. */
export function PageHeader({
  title,
  subtitle,
  meta,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** A live sentence under the large title — counts, not a section label. */
  meta?: React.ReactNode;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [bar, setBar] = useState<HTMLDivElement | null>(null);
  const mounted = useSyncExternalStore(subscribeNever, () => true, () => false);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const heading = titleRef.current;
    if (!heading || !bar) return;
    const observer = new IntersectionObserver(([entry]) => setCompact(!entry.isIntersecting), {
      rootMargin: `-${bar.offsetHeight}px 0px 0px 0px`,
    });
    observer.observe(heading);
    return () => observer.disconnect();
  }, [bar]);

  return (
    <header className="flex flex-col gap-1 pb-6 pt-4 md:pt-10">
      <h1 ref={titleRef} className="text-[34px] font-bold leading-tight tracking-tight">
        {title}
      </h1>
      {subtitle && <p className="text-[15px] leading-snug text-label-secondary">{subtitle}</p>}
      {meta && <div className="text-[15px] leading-snug text-label-secondary">{meta}</div>}

      {/* Portaled: the page wrapper animates transform, which would otherwise pin this to the page, not the screen. */}
      {mounted &&
        createPortal(
          <div
            ref={setBar}
            aria-hidden
            data-visible={compact || undefined}
            className="group pointer-events-none fixed inset-x-0 top-0 z-40 pt-safe opacity-0 transition-opacity duration-150 ease-out data-visible:opacity-100 md:hidden"
          >
            <div className="scroll-edge-top absolute inset-x-0 top-0 -bottom-5 [--edge-solid:70%]" />
            <p className="relative flex h-11 translate-y-1 items-center justify-center px-16 text-[17px] font-semibold transition-transform duration-200 ease-[var(--ease-out-strong)] group-data-visible:translate-y-0 motion-reduce:translate-y-0">
              <span className="truncate">{title}</span>
            </p>
          </div>,
          document.body,
        )}
    </header>
  );
}
