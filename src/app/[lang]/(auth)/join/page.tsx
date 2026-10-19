import type { Metadata } from "next";
import { JoinHome } from "@/components/auth/join-home";
import { getDictionary } from "@/i18n/get-dictionary";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).auth.join };
}

export default function JoinPage() {
  return <JoinHome />;
}
