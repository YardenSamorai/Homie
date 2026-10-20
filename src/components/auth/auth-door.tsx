"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { Check, PenLine } from "lucide-react";
import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
import { authApi } from "@/lib/auth/api";
import { emailPattern } from "@/lib/auth/constants";
import { afterAuthPath } from "@/lib/auth/continue";
import { useAuth, useAuthReady } from "@/lib/auth/session";
import type { AuthSession, InvitePreview } from "@/lib/auth/types";
import { completionHaptic } from "@/lib/haptics";
import { easeOut } from "@/lib/motion";
import { supabaseConfigured } from "@/lib/supabase/env";
import { useOnlineStatus } from "@/lib/use-online-status";
import { DoorStage, type DoorPhase } from "./door-stage";
import { CODE_LENGTH, OtpInput } from "./otp-input";

type Failure = { status?: number; body?: { error?: string; retryAfter?: number } };

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The one way into Homie. New and returning people take the same path: email, code, home. */
export function AuthDoor() {
  const { locale, dict } = useI18n();
  const copy = dict.auth;
  const router = useRouter();
  const reduce = useReducedMotion();
  const online = useOnlineStatus();
  const ready = useAuthReady();
  const stored = useAuth((s) => s.session);
  const setSession = useAuth((s) => s.setSession);
  const signOut = useAuth((s) => s.signOut);

  const [phase, setPhase] = useState<DoorPhase>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [returning, setReturning] = useState(false);
  const submitted = useRef(false);
  const resumed = useRef(false);

  const fail = (key: keyof typeof copy.errors, seconds?: number) =>
    setError(seconds ? format(copy.errors[key], { seconds }) : copy.errors[key]);

  const enter = async (account: AuthSession, celebrate: boolean) => {
    setSession(account);
    const [pending] = await Promise.all([
      authApi.pendingInvite().catch((): InvitePreview | null => null),
      pause(celebrate ? (reduce ? 200 : 950) : 0),
    ]);
    if (celebrate) {
      setLeaving(true);
      await pause(reduce ? 0 : 320);
    }
    router.replace(afterAuthPath(locale, account, pending));
  };

  // Someone who is already signed in, or who just opened the link in the email, walks straight through.
  useEffect(() => {
    if (!ready || resumed.current) return;
    resumed.current = true;
    if (new URLSearchParams(window.location.search).get("link") === "expired") {
      queueMicrotask(() => setError(copy.linkExpired));
    }
    if (!supabaseConfigured()) {
      if (stored) {
        void authApi
          .pendingInvite()
          .catch((): InvitePreview | null => null)
          .then((pending) => router.replace(afterAuthPath(locale, stored, pending)));
      }
      return;
    }
    void authApi
      .currentSession()
      .then(({ account }) => {
        if (account) void enter(account, false);
        else if (stored) signOut();
      })
      .catch(() => {});
    // Runs once, after the stored session is read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  useEffect(() => {
    if (phase !== "code") return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [phase]);

  const wait = Math.max(0, Math.ceil((resendAt - now) / 1000));

  const send = async () => {
    if (busy) return;
    const clean = email.trim().toLowerCase();
    if (!online) return fail("offline");
    if (!emailPattern.test(clean)) return fail("email");
    setBusy(true);
    setError(null);
    try {
      const result = await authApi.sendOtp(clean, locale);
      setEmail(clean);
      setNow(Date.now());
      setResendAt(result.resendAt);
      setCode("");
      submitted.current = false;
      setPhase("code");
    } catch (caught) {
      const { status, body } = caught as Failure;
      if (!status) fail("network");
      else if (body?.error === "wait") {
        setEmail(clean);
        setNow(Date.now());
        setResendAt(Date.now() + (body.retryAfter ?? 60) * 1000);
        setPhase("code");
      } else if (body?.error === "email") fail("email");
      else fail("send");
    } finally {
      setBusy(false);
    }
  };

  const verify = async (next: string) => {
    if (busy || phase === "done" || next.length !== CODE_LENGTH) return;
    if (!online) return fail("offline");
    setBusy(true);
    setError(null);
    try {
      const result = await authApi.verifyOtp(email, next);
      const account: AuthSession = {
        userId: result.userId,
        email: result.email,
        displayName: result.displayName,
        householdId: result.householdId,
        householdName: result.householdName,
        role: result.role,
      };
      completionHaptic();
      setPhase("done");
      await enter(account, true);
    } catch (caught) {
      const { status, body } = caught as Failure;
      if (!status) fail("network");
      else if (body?.error === "locked") fail("tooMany", body.retryAfter);
      else if (body?.error === "expired") fail("expired");
      else fail("code");
      setShake((n) => n + 1);
      setTimeout(() => {
        setCode("");
        submitted.current = false;
      }, reduce ? 0 : 450);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (code.length !== CODE_LENGTH || submitted.current) return;
    submitted.current = true;
    void verify(code);
    // Submits once, the moment the last digit lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const backToEmail = () => {
    setPhase("email");
    setCode("");
    setError(null);
    setReturning(true);
  };

  const step = {
    initial: reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(10px)" },
    animate: { opacity: 1, transform: "translateY(0px)" },
    exit: reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(-8px)" },
  };

  return (
    <motion.main
      initial={false}
      animate={leaving ? { opacity: 0, transform: reduce ? "scale(1)" : "scale(0.985)" } : { opacity: 1, transform: "scale(1)" }}
      transition={{ duration: 0.32, ease: easeOut }}
      className="relative flex min-h-dvh flex-col bg-bg lg:grid lg:h-dvh lg:min-h-[40rem] lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]"
    >
      <div className="relative h-[clamp(15rem,46dvh,27rem)] shrink-0 [@media(max-height:560px)]:h-[9rem] lg:m-3 lg:h-auto lg:overflow-hidden lg:rounded-[36px] lg:bg-[color-mix(in_oklab,var(--sage-light)_45%,var(--bg))]">
        <DoorStage phase={phase} />
      </div>

      <div className="flex flex-1 flex-col px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2 lg:items-center lg:justify-center lg:px-12 lg:pb-12">
        <div className="mx-auto flex w-full max-w-[24.5rem] flex-1 flex-col lg:flex-none">
          <AnimatePresence mode="wait" initial={false}>
            {phase === "email" ? (
              <motion.div
                key="email"
                {...step}
                transition={{ duration: 0.26, ease: easeOut }}
                className="flex flex-1 flex-col"
              >
                <EmailStep
                  email={email}
                  setEmail={(value) => {
                    setEmail(value);
                    setError(null);
                  }}
                  error={error}
                  busy={busy}
                  autoFocus={returning}
                  onSubmit={() => void send()}
                />
              </motion.div>
            ) : (
              <motion.div
                key="code"
                {...step}
                transition={{ duration: 0.26, ease: easeOut }}
                className="flex flex-1 flex-col"
              >
                <CodeStep
                  email={email}
                  code={code}
                  setCode={(value) => {
                    setCode(value);
                    if (value.length < CODE_LENGTH) submitted.current = false;
                    setError(null);
                  }}
                  error={error}
                  busy={busy}
                  done={phase === "done"}
                  shake={shake}
                  wait={wait}
                  onVerify={() => void verify(code)}
                  onResend={() => void send()}
                  onEditEmail={backToEmail}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.main>
  );
}

const title = "text-[2.125rem] leading-[1.06] font-bold tracking-[-0.028em] text-balance lg:text-[2.75rem]";
const lead = "mt-2.5 text-[16px] leading-[1.45] text-label-secondary text-pretty";

function EmailStep({
  email,
  setEmail,
  error,
  busy,
  autoFocus,
  onSubmit,
}: {
  email: string;
  setEmail: (value: string) => void;
  error: string | null;
  busy: boolean;
  autoFocus: boolean;
  onSubmit: () => void;
}) {
  const { dict } = useI18n();
  const copy = dict.auth;

  return (
    <>
      <h1 className={title}>{copy.doorTitle}</h1>
      <p className={lead}>{copy.doorLead}</p>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
        className="mt-7 flex flex-col"
      >
        <div className="relative">
          <input
            id="door-email"
            type="email"
            name="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="send"
            dir="ltr"
            placeholder=" "
            autoFocus={autoFocus}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby="door-message"
            className={`peer h-[3.75rem] w-full rounded-[18px] bg-surface px-4 pt-5 text-[17px] text-label shadow-[0_8px_22px_-14px_rgb(40_30_20/0.3)] outline-none ring-1 transition-[box-shadow] duration-200 ease-[var(--ease-out-strong)] autofill:shadow-[inset_0_0_0_100px_var(--surface)] focus:ring-2 rtl:text-right ${
              error ? "ring-danger/60 focus:ring-danger" : "ring-[light-dark(rgb(40_30_20/0.09),rgb(255_255_255/0.1))] focus:ring-accent"
            }`}
          />
          <label
            htmlFor="door-email"
            className="pointer-events-none absolute start-4 top-1/2 origin-left -translate-y-1/2 text-[17px] text-label-tertiary transition-[translate,scale,color] duration-200 ease-[var(--ease-out-strong)] peer-focus:-translate-y-[118%] peer-focus:scale-[0.76] peer-focus:text-accent peer-[:not(:placeholder-shown)]:-translate-y-[118%] peer-[:not(:placeholder-shown)]:scale-[0.76] rtl:origin-right"
          >
            {copy.email}
          </label>
        </div>
        <Message id="door-message" error={error} />
        <DoorButton state={busy ? "busy" : "idle"} disabled={!email.trim()} label={copy.sendCode} busyLabel={copy.sending} />
      </form>
      <p className="mt-auto pt-8 text-center text-[13px] leading-snug text-label-tertiary lg:mt-8 lg:pt-0">{copy.newHere}</p>
    </>
  );
}

function CodeStep({
  email,
  code,
  setCode,
  error,
  busy,
  done,
  shake,
  wait,
  onVerify,
  onResend,
  onEditEmail,
}: {
  email: string;
  code: string;
  setCode: (value: string) => void;
  error: string | null;
  busy: boolean;
  done: boolean;
  shake: number;
  wait: number;
  onVerify: () => void;
  onResend: () => void;
  onEditEmail: () => void;
}) {
  const { dict } = useI18n();
  const copy = dict.auth;
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
  }, []);

  useEffect(() => {
    if (shake) setTimeout(() => input.current?.focus(), 460);
  }, [shake]);

  const clock = `${Math.floor(wait / 60)}:${String(wait % 60).padStart(2, "0")}`;

  return (
    <>
      <h1 className={title}>{done ? copy.welcomeHome : copy.doorCodeTitle}</h1>
      <p className={`${lead} flex flex-wrap items-center gap-x-1.5 gap-y-1`}>
        <span>{copy.codeSentTo}</span>
        <button
          type="button"
          onClick={onEditEmail}
          disabled={done}
          aria-label={`${copy.editEmail}: ${email}`}
          className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-fill py-1 pe-2.5 ps-3 text-[15px] font-medium text-label transition-[scale,opacity] duration-150 ease-out active:scale-[0.97] disabled:opacity-60"
        >
          <span dir="ltr" className="truncate">
            {email}
          </span>
          <PenLine aria-hidden size={14} className="shrink-0 text-label-secondary" />
        </button>
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onVerify();
        }}
        className="mt-7 flex flex-col"
      >
        <OtpInput
          inputRef={input}
          label={copy.codeTitle}
          value={code}
          onChange={setCode}
          state={done ? "success" : error ? "error" : "idle"}
          shake={shake}
          disabled={done}
          describedBy="door-message"
        />
        <Message id="door-message" error={error} hint={supabaseConfigured() ? null : copy.demoHint} />
        <DoorButton
          state={done ? "done" : busy ? "busy" : "idle"}
          disabled={code.length !== CODE_LENGTH}
          label={copy.enter}
          busyLabel={copy.checking}
          doneLabel={copy.welcomeHome}
        />
      </form>
      <div className="mt-auto flex flex-col items-center gap-1 pt-8 text-center lg:mt-8 lg:pt-0">
        <button
          type="button"
          onClick={onResend}
          disabled={busy || done || wait > 0}
          className="min-h-11 px-3 text-[15px] font-medium text-accent transition-opacity active:opacity-60 disabled:text-label-tertiary"
        >
          {wait > 0 ? (
            <span className="tabular-nums">{format(copy.resendAfter, { time: clock })}</span>
          ) : (
            copy.resendCode
          )}
        </button>
        <p className="text-[13px] leading-snug text-label-tertiary">{copy.spamHint}</p>
      </div>
    </>
  );
}

/** One reserved line under the field, so a message never shoves the button down. */
function Message({ id, error, hint = null }: { id: string; error: string | null; hint?: string | null }) {
  const reduce = useReducedMotion();
  const text = error ?? hint;
  return (
    <div id={id} aria-live="polite" className="min-h-[1.875rem] px-1 pb-2 pt-1.5">
      <AnimatePresence mode="wait" initial={false}>
        {text && (
          <motion.p
            key={text}
            initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(-4px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: easeOut }}
            className={`text-[13px] leading-snug ${error ? "text-danger" : "text-label-tertiary"}`}
          >
            {text}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function DoorButton({
  state,
  disabled,
  label,
  busyLabel,
  doneLabel,
}: {
  state: "idle" | "busy" | "done";
  disabled: boolean;
  label: string;
  busyLabel: string;
  doneLabel?: string;
}) {
  const reduce = useReducedMotion();
  const working = state !== "idle";
  const text = state === "busy" ? busyLabel : state === "done" ? (doneLabel ?? label) : label;

  return (
    <button
      type="submit"
      disabled={disabled && !working}
      aria-disabled={working || undefined}
      aria-busy={state === "busy" || undefined}
      className={`relative h-14 w-full overflow-hidden rounded-full text-[17px] font-semibold text-accent-contrast transition-[scale,background-color,opacity,box-shadow] duration-200 ease-[var(--ease-out-strong)] active:scale-[0.97] disabled:opacity-50 disabled:shadow-none ${
        state === "done"
          ? "bg-green shadow-[0_10px_24px_-10px_color-mix(in_oklab,var(--green)_70%,transparent)]"
          : "bg-accent shadow-[0_10px_24px_-10px_color-mix(in_oklab,var(--accent)_75%,transparent),inset_0_1px_0_rgb(255_255_255/0.22)]"
      } ${working ? "pointer-events-none" : ""}`}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={state}
          initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(12px)" }}
          animate={{ opacity: 1, transform: "translateY(0px)" }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(-12px)" }}
          transition={{ duration: 0.22, ease: easeOut }}
          className="absolute inset-0 flex items-center justify-center gap-2"
        >
          {state === "busy" && (
            <svg viewBox="0 0 24 24" className="size-[18px] animate-spin" aria-hidden>
              <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2.5" />
              <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          )}
          {state === "done" && <Check aria-hidden size={19} strokeWidth={2.75} />}
          {text}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
