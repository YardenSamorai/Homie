import type { Metadata } from "next";
import { getDictionary } from "@/i18n/get-dictionary";
import { CalendarView } from "./calendar-view";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).calendar.title };
}

export default function CalendarPage() {
  return <CalendarView />;
}
