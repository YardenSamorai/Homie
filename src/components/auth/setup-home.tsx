"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/dictionary-provider";
import { authApi } from "@/lib/auth/api";
import { useAuth, useAuthReady } from "@/lib/auth/session";
import { useOnlineStatus } from "@/lib/use-online-status";
import { AuthShell, fieldClass, homeClass } from "./auth-shell";
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
      patch({ householdId: house.id, householdName: house.name, role: "admin" });
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
          <label htmlFor="home-name" className="mb-1.5 block px-1 text-[13px] text-label-secondary">
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
          {error && <p className="mt-2 px-1 text-[13px] text-danger">{error}</p>}
        </div>
        <button type="submit" disabled={busy} className={homeClass}>
          {dict.auth.createHome}
        </button>
      </form>
      <p className="mt-6 px-1 text-[15px] font-semibold">{dict.auth.askInvite}</p>
      <p className="mt-1 px-1 text-[15px] leading-snug text-label-secondary">{dict.auth.askInviteHint}</p>
    </AuthShell>
  );
}
