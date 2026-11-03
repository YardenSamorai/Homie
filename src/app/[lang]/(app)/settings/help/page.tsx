import type { Metadata } from "next";
import { getDictionary } from "@/i18n/get-dictionary";
import { HelpContent } from "../contents";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).settingsNav.sections.help };
}

export default function Page() {
  return <HelpContent />;
}
