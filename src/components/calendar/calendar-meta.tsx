"use client";

import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
import { useHousehold } from "@/lib/household-store";
import { useClock } from "@/lib/use-clock";

export function CalendarMeta() {
  const { dict } = useI18n();
  const today = useClock()?.today;
  const events = useHousehold((s) => s.events);
  if (!today) return null;

  const upcoming = events.filter((event) => event.date >= today).length;
  if (upcoming === 0) return <span>{dict.calendar.upcomingNone}</span>;
  return <span>{upcoming === 1 ? dict.calendar.upcomingOne : format(dict.calendar.upcoming, { count: upcoming })}</span>;
}
