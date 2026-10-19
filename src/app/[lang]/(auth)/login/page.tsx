import type { Metadata } from "next";
import { EmailGate } from "@/components/auth/email-gate";
import { getDictionary } from "@/i18n/get-dictionary";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).auth.signIn };
}

export default function LoginPage() {
  return <EmailGate intent="login" />;
}
