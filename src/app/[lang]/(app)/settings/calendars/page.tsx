import type { Metadata } from "next";
import { getDictionary } from "@/i18n/get-dictionary";
import { CalendarsContent } from "../contents";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).settingsNav.sections.calendars };
}

export default function Page() {
  return <CalendarsContent />;
}
