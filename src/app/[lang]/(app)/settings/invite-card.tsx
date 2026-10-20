"use client";

import { useState } from "react";
import { btnPrimarySm, btnSecondarySm } from "@/components/ui/button";
import { useI18n } from "@/i18n/dictionary-provider";
import { authApi } from "@/lib/auth/api";
import { useAuth } from "@/lib/auth/session";
import { useHousehold } from "@/lib/household-store";
import { useOnlineStatus } from "@/lib/use-online-status";

export function InviteCard() {
  const { locale, dict } = useI18n();
  const session = useAuth((s) => s.session);
  const members = useHousehold((s) => s.members);
  const currentUserId = useHousehold((s) => s.currentUserId);
  const online = useOnlineStatus();
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const inviter = session?.displayName ?? members.find((member) => member.id === currentUserId)?.name ?? "Homie";
  const householdName = session?.householdName || dict.settings.household;

  const mint = async () => {
    if (!online) return setError(dict.auth.errors.offline);
    if (!session?.householdId) return setError(dict.auth.errors.generic);
    setBusy(true);
    setError(null);
    try {
      const invite = await authApi.createInvite({
        householdId: session.householdId,
        householdName,
        inviterName: inviter,
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

  const copy = async () => {
    if (!url) return void mint();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setError(dict.auth.errors.generic);
    }
  };

  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      <p className="text-[15px] leading-snug text-label-secondary">{dict.settings.inviteHint}</p>
      {url && <p className="break-all text-[13px] leading-snug text-label-secondary">{url}</p>}
      {error && <p className="text-[13px] text-danger">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => void copy()} className={btnPrimarySm}>
          {copied ? dict.auth.copied : url ? dict.auth.copyLink : dict.auth.inviteTitle}
        </button>
        {url && (
          <button type="button" disabled={busy} onClick={() => void mint()} className={btnSecondarySm}>
            {dict.auth.newLink}
          </button>
        )}
      </div>
    </div>
  );
}
