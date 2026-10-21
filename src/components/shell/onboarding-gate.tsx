"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/dictionary-provider";
import { authApi } from "@/lib/auth/api";
import { useAuth, useAuthReady } from "@/lib/auth/session";

/**
 * First entry after sign-in is the household door:
 * a name, then either join the invite or create the home.
 */
export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { locale } = useI18n();
  const router = useRouter();
  const ready = useAuthReady();
  const session = useAuth((s) => s.session);
  const allowed = ready && Boolean(session?.displayName && session.householdId);

  useEffect(() => {
    if (!ready || allowed) return;
    let cancelled = false;
    if (!session) router.replace(`/${locale}/login`);
    else if (!session.displayName) router.replace(`/${locale}/welcome`);
    else {
      void authApi
        .pendingInvite()
        .then((pending) => {
          if (!cancelled) router.replace(pending.status === "ok" ? `/${locale}/join` : `/${locale}/setup`);
        })
        .catch(() => {
          if (!cancelled) router.replace(`/${locale}/setup`);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [ready, allowed, session, locale, router]);

  return (
    <>
      {children}
      {!allowed && <div aria-hidden className="fixed inset-0 z-[60] bg-bg" />}
    </>
  );
}
