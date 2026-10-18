import type { Metadata } from "next";
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
      <PageHeader title={dict.calendar.title} />
      <CalendarView />
    </>
  );
}
