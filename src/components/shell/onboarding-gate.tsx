"use client";

import { useEffect, useState } from "react";
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
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    if (!session) {
      setAllowed(false);
      router.replace(`/${locale}/login`);
    } else if (!session.displayName) {
      setAllowed(false);
      router.replace(`/${locale}/welcome`);
    } else if (!session.householdId) {
      setAllowed(false);
      void authApi
        .pendingInvite()
        .then((pending) => {
          if (cancelled) return;
          router.replace(pending.status === "ok" ? `/${locale}/join` : `/${locale}/setup`);
        })
        .catch(() => {
          if (!cancelled) router.replace(`/${locale}/setup`);
        });
    } else {
      setAllowed(true);
    }
    return () => {
      cancelled = true;
    };
  }, [ready, session, locale, router]);

  if (!allowed) return <div className="min-h-dvh bg-bg" />;
  return children;
}
