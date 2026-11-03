"use client";

import { MotionConfig } from "motion/react";
import { DictionaryProvider } from "@/i18n/dictionary-provider";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { Suspense, useEffect } from "react";
import { registerServiceWorker } from "@/lib/install";
import { startNativeShell } from "@/lib/native";
import { reportErrors } from "@/lib/report-errors";
import { PageMarker, useLook, useLookSync } from "@/lib/theme";

export function Providers({
  locale,
  dict,
  children,
}: {
  locale: Locale;
  dict: Dictionary;
  children: React.ReactNode;
}) {
  useLookSync();
  const motion = useLook().motion;
  useEffect(() => {
    void startNativeShell();
    registerServiceWorker();
    return reportErrors();
  }, []);
  return (
    <DictionaryProvider locale={locale} dict={dict}>
      <Suspense fallback={null}>
        <PageMarker />
      </Suspense>
      <MotionConfig reducedMotion={motion === "none" ? "always" : "user"}>{children}</MotionConfig>
    </DictionaryProvider>
  );
}
