import type { Metadata } from "next";
import { getDictionary } from "@/i18n/get-dictionary";
import { NotificationsContent } from "../contents";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).settingsNav.sections.notifications };
}

export default function Page() {
  return <NotificationsContent />;
}
