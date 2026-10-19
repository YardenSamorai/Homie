"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
import { authApi } from "@/lib/auth/api";
import { afterAuthPath } from "@/lib/auth/continue";
import { emailPattern } from "@/lib/auth/constants";
import { useAuth } from "@/lib/auth/session";
import type { InvitePreview } from "@/lib/auth/types";
import { useOnlineStatus } from "@/lib/use-online-status";
import { AuthShell, fieldClass, ghostClass, primaryClass } from "./auth-shell";
import { OtpInput } from "./otp-input";

export function EmailGate({ intent }: { intent: "login" | "register" }) {
  const { locale, dict } = useI18n();
  const router = useRouter();
  const setSession = useAuth((s) => s.setSession);
  const online = useOnlineStatus();

  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(0);
  const submitted = useRef(false);

  useEffect(() => {
    if (step !== "code") return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [step]);

  const wait = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const copy = dict.auth;
  const title = step === "code" ? copy.codeTitle : intent === "register" ? copy.registerTitle : copy.loginTitle;
  const lead =
    step === "code"
      ? format(copy.codeLead, { email })
      : intent === "register"
        ? copy.registerLead
        : copy.loginLead;

  const fail = (key: keyof typeof copy.errors, seconds?: number) => {
    setError(seconds ? format(copy.errors[key], { seconds }) : copy.errors[key]);
  };

  const send = async (nextEmail = email) => {
    if (!online) return fail("offline");
    if (!emailPattern.test(nextEmail.trim().toLowerCase())) return fail("email");
    setBusy(true);
    setError(null);
    try {
      const result = await authApi.sendOtp(nextEmail);
      setEmail(nextEmail.trim());
      setResendAt(result.resendAt);
      setNow(Date.now());
      setCode("");
      submitted.current = false;
      setStep("code");
    } catch (caught) {
      const body = (caught as { body?: { error?: string; retryAfter?: number } }).body;
      if (body?.error === "wait") {
        setResendAt(Date.now() + (body.retryAfter ?? 60) * 1000);
        setStep("code");
      } else if (body?.error === "email") fail("email");
      else fail("send");
    } finally {
      setBusy(false);
    }
  };

  const verify = async (nextCode = code) => {
    if (!online) return fail("offline");
    if (nextCode.length !== 6) return;
    setBusy(true);
    setError(null);
    try {
      const result = await authApi.verifyOtp(email, nextCode);
      const session = {
        userId: result.userId,
        email: result.email,
        displayName: result.displayName,
        householdId: null,
        householdName: null,
        role: null,
      };
      setSession(session);
      let pending: InvitePreview | null = null;
      try {
        pending = await authApi.pendingInvite();
      } catch {
        pending = null;
      }
      router.replace(afterAuthPath(locale, session, pending));
    } catch (caught) {
      submitted.current = false;
      const body = (caught as { body?: { error?: string; retryAfter?: number } }).body;
      if (body?.error === "locked") fail("tooMany", body.retryAfter);
      else if (body?.error === "expired") fail("expired");
      else fail("code");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (code.length !== 6 || submitted.current) return;
    submitted.current = true;
    void verify(code);
    // Auto-submit once the sixth digit lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  return (
    <AuthShell
      size="tall"
      title={title}
      lead={lead}
      footer={
        step === "email" ? (
          intent === "register" ? (
            <>
              {copy.hasAccount}{" "}
              <Link href={`/${locale}/login`} className="font-semibold text-accent">
                {copy.signIn}
              </Link>
            </>
          ) : (
            <>
              {copy.noAccount}{" "}
              <Link href={`/${locale}/register`} className="font-semibold text-accent">
                {copy.createAccount}
              </Link>
            </>
          )
        ) : null
      }
    >
      {step === "email" ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
          className="flex flex-col gap-4"
        >
          <div>
            <label htmlFor="email" className="mb-1.5 block px-1 text-[13px] text-label-secondary">
              {copy.email}
            </label>
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="send"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setError(null);
              }}
              placeholder={copy.emailPlaceholder}
              aria-invalid={error ? true : undefined}
              className={fieldClass}
            />
            {error && <p className="mt-2 px-1 text-[13px] text-danger">{error}</p>}
          </div>
          <button type="submit" disabled={busy || !email.trim()} className={primaryClass}>
            {copy.continue}
          </button>
        </form>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void verify();
          }}
          className="flex flex-col gap-4"
        >
          <OtpInput
            label={copy.codeTitle}
            value={code}
            onChange={(next) => {
              setCode(next);
              setError(null);
            }}
            error={error}
            disabled={busy}
          />
          <p className="px-1 text-[13px] text-label-tertiary">{copy.demoHint}</p>
          <button type="submit" disabled={busy || code.length !== 6} className={primaryClass}>
            {copy.verify}
          </button>
          <button
            type="button"
            disabled={busy || wait > 0}
            onClick={() => void send()}
            className={ghostClass}
          >
            {wait > 0 ? format(copy.resendIn, { seconds: wait }) : copy.resend}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep("email");
              setCode("");
              setError(null);
            }}
            className={ghostClass}
          >
            {copy.changeEmail}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
