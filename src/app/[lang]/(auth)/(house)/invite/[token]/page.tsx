import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { InviteFromParams } from "@/components/auth/invite-landing";
import { getDictionary } from "@/i18n/get-dictionary";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).auth.join };
}

export default function InvitePage() {
  return (
    <Suspense fallback={<AuthShell busy />}>
      <InviteFromParams />
    </Suspense>
  );
}
