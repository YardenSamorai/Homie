"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FrontDoor, type DoorVariant } from "@/components/brand/front-door";
import { useAuth, useAuthReady } from "@/lib/auth/session";
import { periodFor, type Period } from "@/lib/period";

/** Set on <html> by `launchScript` before first paint, and the screen stays the background until the house is drawn. */
function launchVariant(): DoorVariant | null {
  if (typeof document === "undefined") return null;
  const value = document.documentElement.dataset.launch;
  return value === "full" || value === "short" ? value : null;
}

/**
 * Opening the app walks up to the house and in through the front door, where the screen is waiting.
 * Plays only once the household is known, so the door never opens onto the sign-in redirect.
 */
export function LaunchDoor({ children }: { children: React.ReactNode }) {
  const screen = useRef<HTMLDivElement>(null);
  const [variant] = useState(launchVariant);
  const [phase, setPhase] = useState<"waiting" | Period | "done">(variant ? "waiting" : "done");
  const ready = useAuthReady();
  const session = useAuth((s) => s.session);
  const allowed = ready && Boolean(session?.displayName && session.householdId);

  useLayoutEffect(() => {
    if (!variant || !screen.current) return;
    Object.assign(screen.current.style, { position: "fixed", inset: "0", overflow: "hidden", opacity: "0" });
    return () => {
      delete document.documentElement.dataset.launch;
    };
  }, [variant]);

  useEffect(() => {
    if (phase !== "waiting") return;
    // The short wait lets the native splash finish fading before the house appears.
    const timer = window.setTimeout(
      () => setPhase(allowed ? periodFor(new Date().getHours()) : "done"),
      allowed ? 250 : 4000,
    );
    return () => window.clearTimeout(timer);
  }, [phase, allowed]);

  useLayoutEffect(() => {
    if (phase === "waiting") return;
    delete document.documentElement.dataset.launch;
    if (phase === "done") screen.current?.removeAttribute("style");
  }, [phase]);

  return (
    <>
      <div ref={screen}>{children}</div>
      {phase !== "waiting" &&
        phase !== "done" &&
        variant &&
        createPortal(
          <FrontDoor
            period={phase}
            variant={variant}
            targetRef={screen}
            onDone={() => setPhase("done")}
            className="fixed inset-0 z-[100] size-full touch-none"
          />,
          document.body,
        )}
    </>
  );
}
