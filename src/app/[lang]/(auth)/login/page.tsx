import type { Metadata } from "next";
import { AuthDoor } from "@/components/auth/auth-door";
import { getDictionary } from "@/i18n/get-dictionary";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).auth.doorTitle };
}

export default function LoginPage() {
  return <AuthDoor />;
}
