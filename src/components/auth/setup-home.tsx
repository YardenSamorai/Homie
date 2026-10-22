"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/dictionary-provider";
import { authApi } from "@/lib/auth/api";
import { useAuth, useAuthReady } from "@/lib/auth/session";
import { useOnlineStatus } from "@/lib/use-online-status";
import { AuthShell, fieldClass, homeClass, secondaryClass } from "./auth-shell";
import { InviteFaces, inviterColor, memberFrom } from "./invite-faces";

export function SetupHome() {
  const { locale, dict } = useI18n();
  const router = useRouter();
  const ready = useAuthReady();
  const session = useAuth((s) => s.session);
  const patch = useAuth((s) => s.patch);
  const online = useOnlineStatus();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (ready && !session) {
    router.replace(`/${locale}/login`);
    return null;
  }

  const create = async () => {
    const clean = name.trim();
    if (!session) return;
    if (!clean) return setError(dict.auth.errors.name);
    if (!online) return setError(dict.auth.errors.offline);
    setBusy(true);
    setError(null);
    try {
      const house = await authApi.createHousehold(session.userId, clean);
      patch({
        householdId: house.id,
        householdName: house.name,
        role: "admin",
      });
      router.replace(`/${locale}/setup/invite`);
    } catch {
      setError(dict.auth.errors.generic);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      size="tall"
      eyebrow={dict.auth.twoParents}
      title={dict.auth.setupTitle}
      lead={dict.auth.setupLead}
      hero={
        <InviteFaces
          left={memberFrom(session?.displayName ?? "·", inviterColor, "you")}
          right="empty"
          emptyLabel={dict.auth.emptySeat}
        />
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void create();
        }}
        className="flex flex-col gap-4"
      >
        <div>
          <label
            htmlFor="home-name"
            className="mb-1.5 block px-1 text-[13px] text-label-secondary"
          >
            {dict.auth.homeName}
          </label>
          <input
            id="home-name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
            placeholder={dict.auth.homeNamePlaceholder}
            enterKeyHint="done"
            style={{ outline: "none" }}
            className={fieldClass}
          />
          {error && (
            <p className="mt-2 px-1 text-[13px] text-danger">{error}</p>
          )}
        </div>
        <button type="submit" disabled={busy} className={homeClass}>
          {dict.auth.createHome}
        </button>
      </form>
      <PasteInvite />
    </AuthShell>
  );
}

/** The link may have been opened in another browser than this one (Safari before the app was installed). */
function inviteToken(text: string) {
  const clean = text.trim();
  return (
    /\/invite\/([A-Za-z0-9]+)/.exec(clean)?.[1] ??
    (/^[A-Za-z0-9]{8,}$/.test(clean) ? clean : null)
  );
}

function PasteInvite() {
  const { locale, dict } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <div className="mt-6 px-1">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="min-h-11 text-start text-[15px] font-semibold text-accent active:opacity-60"
        >
          {dict.auth.askInvite}
        </button>
        <p className="text-[15px] leading-snug text-label-secondary">
          {dict.auth.askInviteHint}
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const token = inviteToken(link);
        if (!token) return setError(dict.auth.badInviteLink);
        router.push(`/${locale}/invite/${token}`);
      }}
      className="mt-6 flex flex-col gap-3"
    >
      <div>
        <label
          htmlFor="invite-link"
          className="mb-1.5 block px-1 text-[13px] text-label-secondary"
        >
          {dict.auth.inviteLinkLabel}
        </label>
        <input
          id="invite-link"
          dir="ltr"
          autoFocus
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          value={link}
          onChange={(event) => {
            setLink(event.target.value);
            setError(null);
          }}
          placeholder={dict.auth.inviteLinkPlaceholder}
          style={{ outline: "none" }}
          className={`${fieldClass} rtl:text-right`}
        />
        {error && <p className="mt-2 px-1 text-[13px] text-danger">{error}</p>}
      </div>
      <button type="submit" className={secondaryClass}>
        {dict.auth.openInvite}
      </button>
    </form>
  );
}
