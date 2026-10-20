"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Link2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/dictionary-provider";
import { authApi } from "@/lib/auth/api";
import { useAuth, useAuthReady } from "@/lib/auth/session";
import { useOnlineStatus } from "@/lib/use-online-status";
import { AuthShell, ghostClass, homeClass, secondaryClass, successClass } from "./auth-shell";
import { InviteFaces, inviterColor, memberFrom } from "./invite-faces";

export function InvitePartner() {
  const { locale, dict } = useI18n();
  const router = useRouter();
  const ready = useAuthReady();
  const session = useAuth((s) => s.session);
  const online = useOnlineStatus();
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const minted = useRef(false);

  const mint = async () => {
    if (!session?.householdId || !session.displayName) return;
    if (!online) return setError(dict.auth.errors.offline);
    setBusy(true);
    setError(null);
    try {
      const invite = await authApi.createInvite({
        householdId: session.householdId,
        householdName: session.householdName ?? dict.auth.setupTitle,
        inviterName: session.displayName,
        inviterUserId: session.userId,
      });
      setUrl(`${window.location.origin}/${locale}/invite/${invite.token}`);
      setCopied(false);
    } catch {
      setError(dict.auth.errors.generic);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!ready || !session?.householdId || minted.current) return;
    minted.current = true;
    void mint();
    // First visit mints a link.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, session?.householdId]);

  if (ready && !session) {
    router.replace(`/${locale}/login`);
    return null;
  }

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setError(dict.auth.errors.generic);
    }
  };

  return (
    <AuthShell
      size="tall"
      eyebrow={dict.auth.twoParents}
      title={dict.auth.inviteTitle}
      lead={dict.auth.inviteLead}
      hero={
        <InviteFaces
          left={memberFrom(session?.displayName ?? "·", inviterColor, "you")}
          right="empty"
          emptyLabel={dict.auth.emptySeat}
        />
      }
    >
      <div className="flex flex-col gap-3">
        <div className="overflow-hidden rounded-[20px] bg-surface shadow-card ring-1 ring-hairline">
          <div className="flex">
            <span aria-hidden className="w-1.5 shrink-0 bg-today" />
            <div className="min-w-0 flex-1 px-4 py-3">
              <p className="truncate text-[17px] font-semibold">{session?.householdName ?? dict.auth.setupTitle}</p>
              <p className="mt-0.5 text-[13px] text-label-secondary">{dict.auth.linkReady}</p>
            </div>
          </div>
        </div>
        {error && <p className="px-1 text-[13px] text-danger">{error}</p>}
        <button
          type="button"
          disabled={!url || busy}
          onClick={() => void copy()}
          className={copied ? successClass : homeClass}
        >
          {copied ? <Check size={18} strokeWidth={2.25} /> : <Link2 size={18} strokeWidth={2.25} />}
          {copied ? dict.auth.copied : dict.auth.copyLink}
        </button>
        <button type="button" disabled={busy} onClick={() => void mint()} className={secondaryClass}>
          {dict.auth.newLink}
        </button>
        <p className="px-1 text-center text-[13px] text-label/[0.68]">{dict.auth.newLinkHint}</p>
        <button type="button" onClick={() => router.replace(`/${locale}`)} className={ghostClass}>
          {dict.auth.skip}
        </button>
      </div>
    </AuthShell>
  );
}
