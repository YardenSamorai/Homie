import type { Metadata } from "next";
import { CalendarMeta } from "@/components/calendar/calendar-meta";
import { PageHeader } from "@/components/ui/page-header";
import { getDictionary } from "@/i18n/get-dictionary";
import { CalendarView } from "./calendar-view";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).calendar.title };
}

export default async function CalendarPage() {
  const dict = await getDictionary();

  return (
    <>
      <PageHeader title={dict.calendar.title} subtitle={dict.calendar.lead} meta={<CalendarMeta />} />
      <CalendarView />
    </>
  );
}
