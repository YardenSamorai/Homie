"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/i18n/dictionary-provider";

/** A calendar connection that started before Settings had sections comes back to /settings?calendars=…. */
export function LegacyCalendarsRedirect() {
  const { locale } = useI18n();
  const query = useSearchParams();
  const router = useRouter();
  const status = query.get("calendars");
  const account = query.get("account");
  useEffect(() => {
    if (status === null) return;
    const params = new URLSearchParams({ calendars: status });
    if (account !== null) params.set("account", account);
    router.replace(`/${locale}/settings/calendars?${params}#calendars`);
  }, [status, account, locale, router]);
  return null;
}
