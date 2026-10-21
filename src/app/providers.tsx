"use client";

import { MotionConfig } from "motion/react";
import { DictionaryProvider } from "@/i18n/dictionary-provider";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { useEffect } from "react";
import { registerServiceWorker } from "@/lib/install";
import { startNativeShell } from "@/lib/native";
import { reportErrors } from "@/lib/report-errors";
import { useThemeColorSync } from "@/lib/theme";

export function Providers({
  locale,
  dict,
  children,
}: {
  locale: Locale;
  dict: Dictionary;
  children: React.ReactNode;
}) {
  useThemeColorSync();
  useEffect(() => {
    void startNativeShell();
    registerServiceWorker();
    return reportErrors();
  }, []);
  return (
    <DictionaryProvider locale={locale} dict={dict}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </DictionaryProvider>
  );
}
