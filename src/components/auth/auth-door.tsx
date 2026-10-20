"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";
import { useRouter } from "next/navigation";
import { Check, CircleAlert, PenLine } from "lucide-react";
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

/** Steps rise in one after another; the outgoing step lifts away as a single piece. */
const stepVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } },
  exit: { opacity: 0, transform: "translateY(-10px)", transition: { duration: 0.2, ease: easeOut } },
};
const itemVariants: Variants = {
  hidden: { opacity: 0, transform: "translateY(14px)" },
  show: { opacity: 1, transform: "translateY(0px)", transition: { duration: 0.45, ease: easeOut } },
};

/** The page's first welcome, after the house and its moments have arrived. CSS, so it plays before hydration. */
const welcome = (intro: boolean, order: number) =>
  intro ? { className: "door-rise", style: { "--d": `${0.95 + order * 0.07}s` } as CSSProperties } : { className: "", style: undefined };

const shakeFrames = ["translateX(0px)", "translateX(-9px)", "translateX(8px)", "translateX(-5px)", "translateX(3px)", "translateX(0px)"];

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
  const [intro, setIntro] = useState(true);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);
  const [emailShake, setEmailShake] = useState(0);
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

  const toCode = (clean: string, resendFrom: number) => {
    setEmail(clean);
    setNow(Date.now());
    setResendAt(resendFrom);
    setCode("");
    submitted.current = false;
    setIntro(false);
    setPhase("code");
  };

  const send = async () => {
    if (busy) return;
    const clean = email.trim().toLowerCase();
    if (!online) return fail("offline");
    if (!emailPattern.test(clean)) {
      setEmailShake((n) => n + 1);
      return fail("email");
    }
    setBusy(true);
    setError(null);
    try {
      const result = await authApi.sendOtp(clean, locale);
      toCode(clean, result.resendAt);
    } catch (caught) {
      const { status, body } = caught as Failure;
      if (!status) fail("network");
      else if (body?.error === "wait") toCode(clean, Date.now() + (body.retryAfter ?? 60) * 1000);
      else if (body?.error === "email") {
        setEmailShake((n) => n + 1);
        fail("email");
      } else if (body?.error === "limit") fail("mailLimit");
      else if (body?.error === "notAllowed") fail("mailNotAllowed");
      else fail("send");
    } finally {
      setBusy(false);
    }
  };

  const verify = async (next: string) => {
    if (busy || phase === "done") return;
    if (next.length !== CODE_LENGTH) {
      setShake((n) => n + 1);
      return;
    }
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

  return (
    <motion.main
      initial={false}
      animate={leaving ? { opacity: 0, transform: reduce ? "scale(1)" : "scale(0.985)" } : { opacity: 1, transform: "scale(1)" }}
      transition={{ duration: 0.32, ease: easeOut }}
      className="relative flex min-h-dvh flex-col bg-bg lg:grid lg:h-dvh lg:min-h-[40rem] lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] [@media(min-width:640px)_and_(max-height:560px)]:grid [@media(min-width:640px)_and_(max-height:560px)]:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)]"
    >
      {/*
        The house takes whatever height the form leaves, so the screen is composed top to bottom on any phone.
        Layout switches key off width only: the iOS keyboard shrinks the height, and must never re-flow the page.
      */}
      <div className="relative min-h-[max(9rem,30dvh)] flex-1 lg:m-3 lg:overflow-hidden lg:rounded-[36px] lg:bg-[color-mix(in_oklab,var(--sage-light)_45%,var(--bg))]">
        <div className="absolute inset-x-0 bottom-0 top-[env(safe-area-inset-top)] lg:top-0">
          <DoorStage phase={phase} />
        </div>
      </div>

      <div className="relative shrink-0 px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] lg:flex lg:flex-col lg:items-center lg:justify-center lg:px-12 lg:pb-12 [@media(min-width:640px)_and_(max-height:560px)]:flex [@media(min-width:640px)_and_(max-height:560px)]:flex-col [@media(min-width:640px)_and_(max-height:560px)]:justify-center [@media(min-width:640px)_and_(max-height:560px)]:py-4">
        {/* A steady height for both steps, so changing step never nudges the house. */}
        <div className="mx-auto flex min-h-[21rem] w-full max-w-[24.5rem] flex-col">
          <AnimatePresence mode="wait" initial={false}>
            {phase === "email" ? (
              <motion.div
                key="email"
                variants={stepVariants}
                initial="hidden"
                animate="show"
                exit="exit"
                className="flex flex-1 flex-col"
              >
                <EmailStep
                  intro={intro}
                  email={email}
                  setEmail={(value) => {
                    setEmail(value);
                    setError(null);
                  }}
                  error={error}
                  busy={busy}
                  shake={emailShake}
                  autoFocus={returning}
                  onSubmit={() => void send()}
                />
              </motion.div>
            ) : (
              <motion.div
                key="code"
                variants={stepVariants}
                initial="hidden"
                animate="show"
                exit="exit"
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

const title = "text-[clamp(2rem,8.6vw,2.5rem)] leading-[1.06] font-bold tracking-[-0.02em] text-balance lg:text-[2.75rem]";
const lead = "mt-2 text-[16px] leading-[1.5] text-label/[0.72] text-pretty";

function EmailStep({
  intro,
  email,
  setEmail,
  error,
  busy,
  shake,
  autoFocus,
  onSubmit,
}: {
  intro: boolean;
  email: string;
  setEmail: (value: string) => void;
  error: string | null;
  busy: boolean;
  shake: number;
  autoFocus: boolean;
  onSubmit: () => void;
}) {
  const { dict } = useI18n();
  const reduce = useReducedMotion();
  const copy = dict.auth;
  const a = welcome(intro, 0);
  const b = welcome(intro, 1);
  const c = welcome(intro, 2);
  const d = welcome(intro, 3);

  return (
    <>
      <motion.h1 variants={itemVariants} className={`${title} ${a.className}`} style={a.style}>
        {copy.doorTitle}
      </motion.h1>
      <motion.p variants={itemVariants} className={`${lead} ${b.className}`} style={b.style}>
        {copy.doorLead}
      </motion.p>
      <motion.form
        variants={itemVariants}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
        className={`mt-6 flex flex-col ${c.className}`}
        style={c.style}
      >
        <motion.div
          key={shake}
          initial={false}
          animate={shake && !reduce ? { transform: shakeFrames } : undefined}
          transition={{ duration: 0.42, ease: "easeOut" }}
          className="relative"
        >
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
            style={{ outline: "none" }}
            className={`peer h-[3.625rem] w-full rounded-[16px] bg-surface px-4 pt-[1.125rem] text-[17px] text-label shadow-[0_1px_2px_rgb(40_30_20/0.05)] outline-none ring-1 transition-[box-shadow] duration-200 ease-[var(--ease-out-strong)] autofill:shadow-[inset_0_0_0_100px_var(--surface)] focus:ring-2 rtl:text-right ${
              error
                ? "ring-danger/70 focus:shadow-[0_0_0_5px_color-mix(in_oklab,var(--danger)_12%,transparent)]"
                : "ring-[light-dark(rgb(40_30_20/0.1),rgb(255_255_255/0.12))] focus:shadow-[0_0_0_5px_color-mix(in_oklab,var(--accent)_14%,transparent)] focus:ring-accent"
            }`}
          />
          <label
            htmlFor="door-email"
            className="pointer-events-none absolute start-4 top-1/2 origin-left -translate-y-1/2 text-[17px] text-label/50 transition-[translate,scale,color] duration-200 ease-[var(--ease-out-strong)] peer-focus:-translate-y-[118%] peer-focus:scale-[0.76] peer-focus:text-accent peer-[:not(:placeholder-shown)]:-translate-y-[118%] peer-[:not(:placeholder-shown)]:scale-[0.76] peer-[:not(:placeholder-shown)]:text-label/60 rtl:origin-right"
          >
            {copy.email}
          </label>
        </motion.div>
        <Message id="door-message" error={error} />
        <DoorButton state={busy ? "busy" : "idle"} label={copy.sendCode} busyLabel={copy.sending} />
      </motion.form>
      <motion.p
        variants={itemVariants}
        className={`mt-auto flex min-h-11 items-center justify-center pt-3 text-center text-[13px] leading-snug text-label/[0.68] lg:mt-6 ${d.className}`}
        style={d.style}
      >
        {copy.newHere}
      </motion.p>
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
      <motion.h1 variants={itemVariants} className={title}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={done ? "done" : "code"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: easeOut }}
            className="block"
          >
            {done ? copy.welcomeHome : copy.doorCodeTitle}
          </motion.span>
        </AnimatePresence>
      </motion.h1>
      <motion.p variants={itemVariants} className={`${lead} flex flex-wrap items-center gap-x-1.5 gap-y-1.5`}>
        <span>{format(copy.codeSentTo, { count: CODE_LENGTH })}</span>
        <button
          type="button"
          onClick={onEditEmail}
          disabled={done}
          aria-label={`${copy.editEmail}: ${email}`}
          className="inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-full bg-surface py-1 pe-2.5 ps-3 text-[15px] font-medium text-label shadow-[0_1px_2px_rgb(40_30_20/0.06)] ring-1 ring-[light-dark(rgb(40_30_20/0.08),rgb(255_255_255/0.1))] transition-[scale,box-shadow] duration-150 ease-out hover:shadow-[0_2px_8px_rgb(40_30_20/0.08)] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
        >
          <span dir="ltr" className="truncate">
            {email}
          </span>
          <PenLine aria-hidden size={14} className="shrink-0 text-label/60" />
        </button>
      </motion.p>
      <motion.form
        variants={itemVariants}
        onSubmit={(event) => {
          event.preventDefault();
          onVerify();
        }}
        className="mt-6 flex flex-col"
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
        <Message id="door-message" error={error} hint={done ? null : supabaseConfigured() ? copy.spamHint : copy.demoHint} />
        <DoorButton
          state={done ? "done" : busy ? "busy" : "idle"}
          label={copy.enter}
          busyLabel={copy.checking}
          doneLabel={copy.welcomeHome}
        />
      </motion.form>
      <motion.div
        variants={itemVariants}
        className={`mt-auto flex min-h-11 items-center justify-center pt-3 transition-opacity duration-200 lg:mt-6 ${done ? "opacity-0" : ""}`}
      >
        <button
          type="button"
          onClick={onResend}
          disabled={busy || done || wait > 0}
          className="min-h-11 rounded-full px-4 text-[15px] font-semibold text-accent transition-[opacity,background-color] duration-150 hover:bg-[color-mix(in_oklab,var(--accent)_8%,transparent)] active:opacity-60 focus-visible:outline-2 focus-visible:outline-accent disabled:bg-transparent disabled:font-medium disabled:text-label/[0.68]"
        >
          {wait > 0 ? <span className="tabular-nums">{format(copy.resendAfter, { time: clock })}</span> : copy.resendCode}
        </button>
      </motion.div>
    </>
  );
}

/** One reserved line under the field, so a message never shoves the button down. */
function Message({ id, error, hint = null }: { id: string; error: string | null; hint?: string | null }) {
  const reduce = useReducedMotion();
  const text = error ?? hint;
  return (
    <div id={id} aria-live="polite" className="flex min-h-[2.25rem] items-start px-1 pb-2 pt-2">
      <AnimatePresence mode="wait" initial={false}>
        {text && (
          <motion.p
            key={text}
            initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(-4px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: easeOut }}
            className={`flex items-start gap-1.5 text-[13px] leading-snug ${error ? "font-medium text-danger" : "text-label/[0.68]"}`}
          >
            {error && <CircleAlert aria-hidden size={15} strokeWidth={2.25} className="mt-px shrink-0" />}
            {text}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function DoorButton({
  state,
  label,
  busyLabel,
  doneLabel,
}: {
  state: "idle" | "busy" | "done";
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
      aria-disabled={working || undefined}
      aria-busy={state === "busy" || undefined}
      className={`relative h-14 w-full overflow-hidden rounded-full bg-[linear-gradient(180deg,rgb(255_255_255/0.16),rgb(255_255_255/0)_62%)] text-[17px] font-semibold tracking-[-0.01em] text-accent-contrast transition-[scale,box-shadow,filter,background-color] duration-200 ease-[var(--ease-out-strong)] focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-accent ${
        state === "done"
          ? "bg-green shadow-[inset_0_1px_0_rgb(255_255_255/0.22),0_12px_26px_-12px_color-mix(in_oklab,var(--green)_80%,transparent)]"
          : "bg-accent shadow-[inset_0_1px_0_rgb(255_255_255/0.22),0_1px_2px_rgb(37_79_65/0.22),0_12px_26px_-12px_color-mix(in_oklab,var(--accent)_80%,transparent)] hover:brightness-[1.05] hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.22),0_1px_2px_rgb(37_79_65/0.22),0_16px_32px_-12px_color-mix(in_oklab,var(--accent)_85%,transparent)] active:scale-[0.97] active:brightness-95 active:duration-100"
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
