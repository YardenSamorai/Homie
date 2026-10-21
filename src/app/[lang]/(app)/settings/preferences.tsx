"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
import { useActivity } from "@/lib/activity-store";
import { authApi } from "@/lib/auth/api";
import { useAuth } from "@/lib/auth/session";
import { useHousehold } from "@/lib/household-store";
import { isNativeApp } from "@/lib/native";
import { morningHours, notifyKinds } from "@/lib/prefs";
import { usePrefs } from "@/lib/prefs-store";
import { forgetPush } from "@/lib/push/client";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { supabaseConfigured } from "@/lib/supabase/env";
import { ConfirmPanel } from "./confirm-panel";

const row = "flex min-h-12 items-center justify-between gap-3 px-4";
const first = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/** Which of the other parent's actions reach this phone, and the morning summary. The bell keeps everything. */
export function NotificationPrefs() {
  const { dict } = useI18n();
  const userId = useAuth((s) => s.session?.userId) ?? "";
  const prefs = usePrefs((s) => s.prefs);
  const update = usePrefs((s) => s.update);
  const copy = dict.prefs;

  return (
    <>
      <Card title={copy.notifyTitle}>
        <ul className="divide-y divide-separator">
          {notifyKinds.map((kind) => (
            <li key={kind} className={row}>
              <span className="text-[17px]">{copy.kinds[kind]}</span>
              <Switch
                checked={prefs.notify[kind]}
                label={copy.kinds[kind]}
                onChange={(on) => update(userId, "notify", { ...prefs.notify, [kind]: on })}
              />
            </li>
          ))}
        </ul>
        <p className="px-4 pb-3 pt-1 text-[13px] leading-snug text-label-secondary">{copy.notifyHint}</p>
      </Card>
      <Card title={copy.morningTitle}>
        <div className={row}>
          <span className="text-[17px]">{copy.morningOn}</span>
          <Switch checked={prefs.morning.on} label={copy.morningOn} onChange={(on) => update(userId, "morning", { ...prefs.morning, on })} />
        </div>
        {prefs.morning.on && (
          <div className="flex items-center justify-between gap-3 border-t border-separator px-4 py-2.5">
            <span className="shrink-0 text-[17px]">{copy.morningAt}</span>
            <div className="w-48">
              <SegmentedControl
                label={copy.morningAt}
                value={String(prefs.morning.hour)}
                onChange={(hour) => update(userId, "morning", { ...prefs.morning, hour: Number(hour) })}
                options={morningHours.map((hour) => ({ value: String(hour), label: `${String(hour).padStart(2, "0")}:00` }))}
              />
            </div>
          </div>
        )}
        <p className="px-4 pb-3 pt-1 text-[13px] leading-snug text-label-secondary">{copy.morningHint}</p>
      </Card>
    </>
  );
}

/** How a new task starts, in the add sheet and the quick add field. */
export function NewTaskDefaults() {
  const { dict } = useI18n();
  const userId = useAuth((s) => s.session?.userId) ?? "";
  const prefs = usePrefs((s) => s.prefs);
  const update = usePrefs((s) => s.update);
  const partner = useHousehold((s) => s.members.find((member) => member.id !== s.currentUserId));
  const copy = dict.prefs;

  return (
    <Card title={copy.newTaskTitle}>
      {partner && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5">
          <span className="shrink-0 text-[17px]">{copy.assignee}</span>
          <div className="w-48">
            <SegmentedControl
              label={copy.assignee}
              value={prefs.newTask.assignee}
              onChange={(assignee) => update(userId, "newTask", { ...prefs.newTask, assignee })}
              options={[
                { value: "me", label: copy.me },
                { value: "partner", label: first(partner.name) || copy.partnerFallback },
              ]}
            />
          </div>
        </div>
      )}
      <div className={`flex items-center justify-between gap-3 px-4 py-2.5 ${partner ? "border-t border-separator" : ""}`}>
        <span className="shrink-0 text-[17px]">{copy.due}</span>
        <div className="w-48">
          <SegmentedControl
            label={copy.due}
            value={prefs.newTask.due}
            onChange={(due) => update(userId, "newTask", { ...prefs.newTask, due })}
            options={[
              { value: "today", label: copy.dueToday },
              { value: "none", label: copy.dueNone },
            ]}
          />
        </div>
      </div>
      <p className="px-4 pb-3 pt-1 text-[13px] leading-snug text-label-secondary">{copy.newTaskHint}</p>
    </Card>
  );
}

/** The name the house and the notifications show. */
export function MyName() {
  const { dict } = useI18n();
  const session = useAuth((s) => s.session);
  const patch = useAuth((s) => s.patch);
  const saved = session?.displayName ?? "";
  const [name, setName] = useState(saved);
  const [shown, setShown] = useState(saved);
  const [state, setState] = useState<"idle" | "busy" | "saved" | "failed">("idle");
  const copy = dict.prefs;
  if (saved !== shown) {
    setShown(saved);
    setName(saved);
  }
  const clean = name.trim();
  const dirty = clean.length > 0 && clean !== saved;

  const save = async () => {
    if (!session || !dirty) return;
    setState("busy");
    try {
      const profile = await authApi.saveName(session.userId, clean);
      patch({ displayName: profile.displayName });
      const { members, setRoster, currentUserId } = useHousehold.getState();
      setRoster(currentUserId, members.map((member) => (member.id === session.userId ? { ...member, name: profile.displayName } : member)));
      setState("saved");
    } catch {
      setState("failed");
    }
  };

  return (
    <Card title={copy.nameTitle}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
        className="flex flex-col gap-3 p-4"
      >
        <input
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setState("idle");
          }}
          maxLength={40}
          aria-label={copy.nameTitle}
          autoComplete="name"
          enterKeyHint="done"
          className="h-12 w-full rounded-xl bg-fill px-4 text-[17px] text-label outline-none placeholder:text-label-tertiary"
        />
        <p className={`text-[13px] leading-snug ${state === "failed" ? "text-danger" : "text-label-secondary"}`}>
          {state === "failed" ? copy.nameFailed : copy.nameHint}
        </p>
        <button
          type="submit"
          disabled={!dirty || state === "busy"}
          className="min-h-11 self-start rounded-full bg-accent px-5 text-[15px] font-semibold text-accent-contrast transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-40"
        >
          {state === "saved" && !dirty ? copy.saved : copy.save}
        </button>
      </form>
    </Card>
  );
}

/** Deletes the account for good, after saying what goes and what stays with the other parent. */
export function DeleteAccount() {
  const { locale, dict } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const partner = useHousehold((s) => s.members.find((member) => member.id !== s.currentUserId));
  const copy = dict.prefs;
  if (!supabaseConfigured()) return null;

  const remove = async () => {
    const response = await fetch("/api/account/delete", { method: "POST" });
    if (!response.ok) throw new Error(String(response.status));
    await forgetPush().catch(() => {});
    await createBrowserSupabase().auth.signOut().catch(() => {});
    useHousehold.getState().syncSelf(null);
    useActivity.getState().clear();
    useAuth.getState().signOut();
    router.replace(`/${locale}/login`);
  };

  return (
    <div className="border-t border-separator">
      {!open && (
        <button type="button" onClick={() => setOpen(true)} className="min-h-12 w-full px-4 text-start text-[17px] font-medium text-danger active:bg-fill">
          {copy.deleteAccount}
        </button>
      )}
      <div className={open ? "pt-3" : ""}>
        <ConfirmPanel
          open={open}
          title={copy.deleteTitle}
          body={partner ? format(copy.deleteBody, { name: first(partner.name) }) : copy.deleteAlone}
          confirm={copy.deleteConfirm}
          failure={copy.deleteUnavailable}
          onConfirm={remove}
          onCancel={() => setOpen(false)}
        />
      </div>
    </div>
  );
}

const subscribeNever = () => () => {};

/** Which version this is (the iPhone build, or the day the site was built), a way to write to us, and the privacy policy. */
export function AboutCard() {
  const { locale, dict } = useI18n();
  const native = useSyncExternalStore(subscribeNever, isNativeApp, () => false);
  const [build, setBuild] = useState<{ version: string; build: string } | null>(null);
  const copy = dict.prefs;
  const support = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
  const version = process.env.NEXT_PUBLIC_BUILD_DATE ?? "";

  useEffect(() => {
    if (!native) return;
    let live = true;
    void import("@capacitor/app")
      .then(({ App }) => App.getInfo())
      .then((info) => live && setBuild({ version: info.version, build: info.build }))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [native]);

  return (
    <Card title={copy.aboutTitle}>
      <ul className="divide-y divide-separator">
        <li className={row}>
          <span className="text-[17px]">{copy.version}</span>
          <span className="text-[15px] tabular-nums text-label-secondary">
            {build ? format(copy.app, { version: build.version, build: build.build }) : `${copy.web} ${version}`}
          </span>
        </li>
        {support && (
          <li>
            <a href={`mailto:${support}?subject=Homie`} className={`${row} text-[17px] text-accent active:bg-fill`}>
              {copy.feedback}
              <ChevronLeft aria-hidden size={18} className="text-label-tertiary ltr:-scale-x-100" />
            </a>
          </li>
        )}
        <li>
          <Link href={`/${locale}/privacy`} className={`${row} text-[17px] active:bg-fill`}>
            {copy.privacy}
            <ChevronLeft aria-hidden size={18} className="text-label-tertiary ltr:-scale-x-100" />
          </Link>
        </li>
      </ul>
    </Card>
  );
}
