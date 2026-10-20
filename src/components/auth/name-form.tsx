"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { UserRound } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Tilt } from "@/components/ui/tilt";
import { useI18n } from "@/i18n/dictionary-provider";
import { authApi } from "@/lib/auth/api";
import { afterAuthPath } from "@/lib/auth/continue";
import { useAuth, useAuthReady } from "@/lib/auth/session";
import { settle } from "@/lib/motion";
import { useOnlineStatus } from "@/lib/use-online-status";
import { AuthShell, fieldClass, homeClass } from "./auth-shell";
import { inviterColor, memberFrom } from "./invite-faces";

export function NameForm() {
  const { locale, dict } = useI18n();
  const router = useRouter();
  const ready = useAuthReady();
  const session = useAuth((s) => s.session);
  const patch = useAuth((s) => s.patch);
  const online = useOnlineStatus();
  const reduce = useReducedMotion();
  const [name, setName] = useState(session?.displayName ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const motionProps = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.2 } }
    : settle;

  if (ready && !session) {
    router.replace(`/${locale}/login`);
    return null;
  }

  const submit = async () => {
    const clean = name.trim();
    if (!clean) return setError(dict.auth.errors.name);
    if (!online) return setError(dict.auth.errors.offline);
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      await authApi.saveName(session.userId, clean);
      patch({ displayName: clean });
      const next = { ...session, displayName: clean };
      let pending = null;
      try {
        pending = await authApi.pendingInvite();
      } catch {
        pending = null;
      }
      router.replace(afterAuthPath(locale, next, pending));
    } catch {
      setError(dict.auth.errors.generic);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title={dict.auth.nameTitle}
      lead={dict.auth.nameLead}
      hero={
        <motion.div {...motionProps} className="flex justify-center">
          <Tilt className="drop-shadow-[0_10px_20px_rgb(40_30_20/0.16)]">
            {name.trim() ? (
              <Avatar member={memberFrom(name, inviterColor, "you")} size={96} />
            ) : (
              <span className="flex size-24 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--indigo)_14%,var(--surface))] text-indigo ring-1 ring-[color-mix(in_oklab,var(--indigo)_20%,transparent)]">
                <UserRound size={40} strokeWidth={1.75} />
              </span>
            )}
          </Tilt>
        </motion.div>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        className="flex flex-col gap-4"
      >
        <div>
          <label htmlFor="display-name" className="mb-1.5 block px-1 text-[13px] text-label-secondary">
            {dict.auth.displayName}
          </label>
          <input
            id="display-name"
            autoComplete="name"
            enterKeyHint="done"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
            style={{ outline: "none" }}
            className={fieldClass}
          />
          {error && <p className="mt-2 px-1 text-[13px] text-danger">{error}</p>}
        </div>
        <button type="submit" disabled={busy} className={homeClass}>
          {dict.auth.saveName}
        </button>
      </form>
    </AuthShell>
  );
}
