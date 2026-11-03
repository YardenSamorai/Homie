import type { Metadata } from "next";
import { getDictionary } from "@/i18n/get-dictionary";
import { ProfileContent } from "../contents";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).settingsNav.sections.profile };
}

export default function Page() {
  return <ProfileContent />;
}
