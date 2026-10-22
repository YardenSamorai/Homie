"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Link2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
import { authApi } from "@/lib/auth/api";
import { useAuth, useAuthReady } from "@/lib/auth/session";
import { avatarUrl } from "@/lib/avatar-url";
import { useOnlineStatus } from "@/lib/use-online-status";
import {
  AuthShell,
  ghostClass,
  homeClass,
  secondaryClass,
  successClass,
} from "./auth-shell";
import {
  InviteFaces,
  inviterColor,
  memberFrom,
  partnerColor,
} from "./invite-faces";

const WATCH_MS = 4000;

type Partner = { name: string; photo: string | null };

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
  const [partner, setPartner] = useState<Partner | null>(null);
  const minted = useRef(false);

  const mint = async (fresh: boolean) => {
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
        fresh,
      });
      setUrl(`${window.location.origin}/${locale}/invite/${invite.token}`);
      setCopied(false);
    } catch (caught) {
      // A full house means the partner is already in; the watcher below shows who.
      if ((caught as { body?: { error?: string } }).body?.error !== "full")
        setError(dict.auth.errors.generic);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!ready || !session?.householdId || minted.current) return;
    minted.current = true;
    void mint(false);
    // First visit fetches the live link, minting one only if none is out there.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, session?.householdId]);

  // The partner joins on their own phone; this screen notices and says so.
  const householdId = session?.householdId;
  const userId = session?.userId;
  useEffect(() => {
    if (!householdId || partner) return;
    let alive = true;
    const look = async (first = false) => {
      if (!first && document.visibilityState !== "visible") return;
      try {
        const house = await authApi.household(householdId);
        const other = house.members.find((member) => member.id !== userId);
        if (alive && other)
          setPartner({ name: other.name, photo: avatarUrl(other.avatarPath) });
      } catch {
        // Offline or a blip: the next tick tries again.
      }
    };
    void look(true);
    const timer = setInterval(() => void look(), WATCH_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [householdId, userId, partner]);

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

  const you = memberFrom(session?.displayName ?? "·", inviterColor, "you");

  if (partner) {
    return (
      <AuthShell
        size="tall"
        eyebrow={dict.auth.twoParents}
        title={format(dict.auth.partnerJoined, { name: partner.name })}
        lead={dict.auth.partnerJoinedLead}
        hero={
          <InviteFaces
            left={you}
            right={memberFrom(
              partner.name,
              partnerColor,
              "partner",
              partner.photo
            )}
            emptyLabel={dict.auth.emptySeat}
          />
        }
      >
        <button
          type="button"
          onClick={() => router.replace(`/${locale}`)}
          className={homeClass}
        >
          {dict.auth.goHome}
        </button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      size="tall"
      eyebrow={dict.auth.twoParents}
      title={dict.auth.inviteTitle}
      lead={dict.auth.inviteLead}
      hero={
        <InviteFaces
          left={you}
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
              <p className="truncate text-[17px] font-semibold">
                {session?.householdName ?? dict.auth.setupTitle}
              </p>
              <p className="mt-0.5 text-[13px] text-label-secondary">
                {dict.auth.linkReady}
              </p>
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
          {copied ? (
            <Check size={18} strokeWidth={2.25} />
          ) : (
            <Link2 size={18} strokeWidth={2.25} />
          )}
          {copied ? dict.auth.copied : dict.auth.copyLink}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void mint(true)}
          className={secondaryClass}
        >
          {dict.auth.newLink}
        </button>
        <p className="px-1 text-center text-[13px] text-label/[0.68]">
          {dict.auth.newLinkHint}
        </p>
        <button
          type="button"
          onClick={() => router.replace(`/${locale}`)}
          className={ghostClass}
        >
          {dict.auth.skip}
        </button>
      </div>
    </AuthShell>
  );
}
