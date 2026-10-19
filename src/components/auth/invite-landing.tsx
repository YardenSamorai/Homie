"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
import { authApi } from "@/lib/auth/api";
import { useAuth } from "@/lib/auth/session";
import type { InvitePreview, InviteStatus } from "@/lib/auth/types";
import { AuthShell, homeClass, primaryClass } from "./auth-shell";
import { InviteFaces, inviterColor, memberFrom } from "./invite-faces";

function messageFor(status: InviteStatus, dict: ReturnType<typeof useI18n>["dict"]) {
  switch (status) {
    case "expired":
      return dict.auth.inviteExpired;
    case "revoked":
      return dict.auth.inviteRevoked;
    case "used":
      return dict.auth.inviteUsed;
    case "full":
      return dict.auth.inviteFull;
    default:
      return dict.auth.inviteMissing;
  }
}

export function InviteFromParams() {
  const { token } = useParams<{ token: string }>();
  if (!token) return null;
  return <InviteLanding token={token} />;
}

export function InviteLanding({ token }: { token: string }) {
  const { locale, dict } = useI18n();
  const session = useAuth((s) => s.session);
  const [invite, setInvite] = useState<InvitePreview | null>(null);

  useEffect(() => {
    let alive = true;
    void authApi.previewInvite(token).then((next) => {
      if (alive) setInvite(next);
    });
    return () => {
      alive = false;
    };
  }, [token]);

  const ok = invite?.status === "ok";
  const you = session?.displayName ? memberFrom(session.displayName, "var(--pink)", "you") : "empty";
  const href = session ? `/${locale}/join` : `/${locale}/register`;

  return (
    <AuthShell
      busy={!invite}
      eyebrow={ok ? dict.auth.youreInvited : undefined}
      title={ok ? (invite.householdName ?? dict.auth.setupTitle) : invite ? dict.auth.invalidTitle : undefined}
      lead={ok ? format(dict.auth.joinLead, { inviter: invite.inviterName ?? "" }) : invite ? messageFor(invite.status, dict) : undefined}
      hero={
        ok ? (
          <InviteFaces
            left={memberFrom(invite.inviterName ?? "·", inviterColor, "inviter")}
            right={you}
            emptyLabel={dict.auth.emptySeat}
          />
        ) : !invite ? (
          <div aria-hidden className="mx-auto size-[72px] animate-pulse rounded-full bg-fill" />
        ) : undefined
      }
    >
      {ok && (
        <Link href={href} className={homeClass}>
          {session ? dict.auth.join : dict.auth.joinSignIn}
        </Link>
      )}
      {invite && !ok && (
        <Link href={session ? `/${locale}/setup` : `/${locale}/register`} className={primaryClass}>
          {dict.auth.createInstead}
        </Link>
      )}
    </AuthShell>
  );
}
