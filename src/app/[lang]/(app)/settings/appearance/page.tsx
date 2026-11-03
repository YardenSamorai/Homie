import type { Metadata } from "next";
import { getDictionary } from "@/i18n/get-dictionary";
import { AppearanceContent } from "../contents";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).settingsNav.sections.appearance };
}

export default function Page() {
  return <AppearanceContent />;
}
