import type { Metadata } from "next";
import { InvitePartner } from "@/components/auth/invite-partner";
import { getDictionary } from "@/i18n/get-dictionary";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).auth.inviteTitle };
}

export default function SetupInvitePage() {
  return <InvitePartner />;
}
