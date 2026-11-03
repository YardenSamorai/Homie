import type { Metadata } from "next";
import { getDictionary } from "@/i18n/get-dictionary";
import { AccountContent } from "../contents";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).settingsNav.sections.account };
}

export default function Page() {
  return <AccountContent />;
}
