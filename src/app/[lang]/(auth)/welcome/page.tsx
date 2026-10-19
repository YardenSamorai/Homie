import type { Metadata } from "next";
import { NameForm } from "@/components/auth/name-form";
import { getDictionary } from "@/i18n/get-dictionary";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).auth.nameTitle };
}

export default function WelcomePage() {
  return <NameForm />;
}
