import type { Metadata } from "next";
import { getDictionary } from "@/i18n/get-dictionary";
import { HouseContent } from "../contents";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).settingsNav.sections.house };
}

export default function Page() {
  return <HouseContent />;
}
