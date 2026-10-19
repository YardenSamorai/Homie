import type { Metadata } from "next";
import { SetupHome } from "@/components/auth/setup-home";
import { getDictionary } from "@/i18n/get-dictionary";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).auth.setupTitle };
}

export default function SetupPage() {
  return <SetupHome />;
}
