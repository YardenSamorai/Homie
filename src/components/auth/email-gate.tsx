"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
import { authApi } from "@/lib/auth/api";
import { afterAuthPath } from "@/lib/auth/continue";
import { emailPattern } from "@/lib/auth/constants";
import { useAuth } from "@/lib/auth/session";
import type { InvitePreview } from "@/lib/auth/types";
import { easeOut } from "@/lib/motion";
import { supabaseConfigured } from "@/lib/supabase/env";
import { useOnlineStatus } from "@/lib/use-online-status";
import { btnPrimary } from "@/components/ui/button";
import { OtpInput } from "./otp-input";

export function EmailGate(_props: { intent: "login" | "register" }) {
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
  const reduce = useReducedMotion();
  const title = step === "code" ? copy.codeTitle : copy.doorTitle;
  const lead = step === "code" ? format(copy.codeLead, { email }) : copy.doorLead;

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
    <main className="flex min-h-dvh flex-col bg-bg px-6 pt-[max(4.75rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <motion.div
        key={step}
        initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(8px)" }}
        animate={{ opacity: 1, transform: "translateY(0px)" }}
        transition={{ duration: 0.28, ease: easeOut }}
        className="mx-auto flex w-full max-w-[24rem] flex-1 flex-col"
      >
        <p className="text-[15px] font-semibold tracking-tight text-accent">Homie</p>
        <h1 className="mt-4 text-[40px] leading-[1.05] font-bold tracking-[-0.02em] text-balance">{title}</h1>
        <p className="mt-3 max-w-[20rem] text-[17px] leading-snug text-label-secondary text-pretty">{lead}</p>

        {step === "email" ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
            className="mt-12 flex flex-col gap-3"
          >
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
              aria-label={copy.email}
              aria-invalid={error ? true : undefined}
              className="h-[52px] w-full rounded-[14px] bg-surface px-4 text-[17px] text-label outline-none ring-1 ring-[light-dark(rgb(40_30_20/0.08),rgb(255_255_255/0.1))] placeholder:text-label-tertiary"
            />
            {error && <p className="px-1 text-[13px] text-danger">{error}</p>}
            <button type="submit" disabled={busy || !email.trim()} className={`${btnPrimary} rounded-[14px]`}>
              {copy.sendCode}
            </button>
          </form>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void verify();
            }}
            className="mt-12 flex flex-col gap-5"
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
            {!supabaseConfigured() && <p className="px-1 text-[13px] text-label-tertiary">{copy.demoHint}</p>}
            <button type="submit" disabled={busy || code.length !== 6} className={`${btnPrimary} rounded-[14px]`}>
              {copy.verify}
            </button>
            <div className="flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setError(null);
                }}
                className="min-h-11 text-[15px] font-medium text-accent active:opacity-60"
              >
                {copy.changeEmail}
              </button>
              <button
                type="button"
                disabled={busy || wait > 0}
                onClick={() => void send()}
                className="min-h-11 text-[15px] font-medium text-label-secondary active:opacity-60 disabled:opacity-40"
              >
                {wait > 0 ? format(copy.resendIn, { seconds: wait }) : copy.resend}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </main>
  );
}
