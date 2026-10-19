"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
import { authApi } from "@/lib/auth/api";
import { useAuth, useAuthReady } from "@/lib/auth/session";
import type { InvitePreview } from "@/lib/auth/types";
import { useOnlineStatus } from "@/lib/use-online-status";
import { AuthShell, ghostClass, homeClass, primaryClass } from "./auth-shell";
import { InviteFaces, inviterColor, memberFrom, partnerColor } from "./invite-faces";

export function JoinHome() {
  const { locale, dict } = useI18n();
  const router = useRouter();
  const ready = useAuthReady();
  const session = useAuth((s) => s.session);
  const patch = useAuth((s) => s.patch);
  const online = useOnlineStatus();
  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void authApi.pendingInvite().then((next) => {
      if (alive) setInvite(next);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (ready && !session) {
    router.replace(`/${locale}/login`);
    return null;
  }

  const ok = invite?.status === "ok";
  const here = Boolean(ok && session?.householdId && session.householdId === invite?.householdId);
  const blocked = Boolean(ok && session?.householdId && !here);

  const join = async () => {
    if (!session) return;
    if (!online) return setError(dict.auth.errors.offline);
    setBusy(true);
    setError(null);
    try {
      const result = await authApi.acceptInvite(session.userId);
      patch({ householdId: result.householdId, householdName: result.householdName, role: "member" });
      router.replace(`/${locale}`);
    } catch (caught) {
      const status = (caught as { body?: { error?: string } }).body?.error;
      if (status === "already") setError(dict.auth.alreadyHomeHint);
      else setError(dict.auth.staleInvite);
    } finally {
      setBusy(false);
    }
  };

  const you = memberFrom(session?.displayName ?? dict.auth.emptySeat, partnerColor, "you");

  return (
    <AuthShell
      busy={!invite}
      eyebrow={ok && !blocked && !here ? dict.auth.youreInvited : undefined}
      title={
        here
          ? dict.auth.alreadyHere
          : blocked
            ? dict.auth.alreadyHome
            : ok
              ? (invite.householdName ?? dict.auth.setupTitle)
              : invite
                ? dict.auth.invalidTitle
                : undefined
      }
      lead={
        here
          ? dict.auth.alreadyHereHint
          : blocked
            ? dict.auth.alreadyHomeHint
            : ok
              ? format(dict.auth.joinLead, { inviter: invite.inviterName ?? "" })
              : invite
                ? dict.auth.staleInvite
                : undefined
      }
      hero={
        ok && !blocked && !here ? (
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
      {error && <p className="mb-3 px-1 text-[13px] text-danger">{error}</p>}
      {ok && !blocked && !here && (
        <>
          <button type="button" disabled={busy} onClick={() => void join()} className={homeClass}>
            {dict.auth.join}
          </button>
          <button type="button" onClick={() => router.replace(`/${locale}/setup`)} className={ghostClass}>
            {dict.auth.createInstead}
          </button>
        </>
      )}
      {invite && !ok && (
        <button type="button" onClick={() => router.replace(`/${locale}/setup`)} className={primaryClass}>
          {dict.auth.createInstead}
        </button>
      )}
      {(blocked || here) && (
        <button type="button" onClick={() => router.replace(`/${locale}`)} className={primaryClass}>
          {dict.auth.goHome}
        </button>
      )}
    </AuthShell>
  );
}
