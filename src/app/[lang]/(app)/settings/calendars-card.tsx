"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { CalendarSync, ExternalLink, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useAgo } from "@/components/shell/activity";
import { reloadHouseCalendar } from "@/components/shell/house-extras-sync";
import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
import { useAuth } from "@/lib/auth/session";
import { isNativeApp } from "@/lib/native";
import { ConfirmPanel } from "./confirm-panel";

type Sharing = "details" | "busy" | "private";
type Provider = "google" | "microsoft";

type CalendarView = {
  id: string;
  name: string;
  color: string | null;
  isPrimary: boolean;
  selected: boolean;
  sharing: Sharing | null;
  together: boolean;
  lastSyncedAt: string | null;
  lastError: string | null;
  gone: boolean;
};
type AccountView = {
  id: string;
  provider: Provider;
  email: string | null;
  status: "active" | "reauth" | "error";
  lastSyncedAt: string | null;
  lastError: string | null;
  calendars: CalendarView[];
};
type Overview = {
  setup: { ready: boolean; missing: string[]; google: boolean; microsoft: boolean };
  accounts: AccountView[];
  preview?: boolean;
};

const row = "flex min-h-12 items-center gap-3 px-4 py-2.5";
const rule = "border-t border-separator";
const pill =
  "flex min-h-10 items-center justify-center gap-1.5 rounded-full px-4 text-[15px] font-semibold transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-40";

const subscribeNever = () => () => {};

/** Development only (?calendarsPreview): what the card looks like with accounts, marked as a sample, nothing live. */
function previewOverview(): Overview {
  const hour = 60 * 60_000;
  return {
    preview: true,
    setup: { ready: true, missing: [], google: true, microsoft: true },
    accounts: [
      {
        id: "preview-google",
        provider: "google",
        email: "parent@example.com",
        status: "active",
        lastSyncedAt: new Date(Date.now() - 0.1 * hour).toISOString(),
        lastError: null,
        calendars: [
          { id: "p1", name: "parent@example.com", color: "#4a8696", isPrimary: true, selected: true, sharing: "details", together: false, lastSyncedAt: null, lastError: null, gone: false },
          { id: "p2", name: "משפחה · Family", color: "#b0647a", isPrimary: false, selected: true, sharing: "details", together: true, lastSyncedAt: null, lastError: null, gone: false },
          { id: "p3", name: "עבודה", color: "#b8742e", isPrimary: false, selected: false, sharing: null, together: false, lastSyncedAt: null, lastError: null, gone: false },
        ],
      },
      {
        id: "preview-microsoft",
        provider: "microsoft",
        email: "parent@work.example",
        status: "reauth",
        lastSyncedAt: new Date(Date.now() - 30 * hour).toISOString(),
        lastError: "reauth",
        calendars: [
          { id: "p4", name: "Calendar", color: null, isPrimary: true, selected: true, sharing: "busy", together: false, lastSyncedAt: null, lastError: null, gone: false },
        ],
      },
    ],
  };
}

async function post(body: unknown): Promise<Overview | null> {
  const response = await fetch("/api/calendars", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(String(response.status));
  const data = (await response.json()) as Overview | { ok: true };
  return "accounts" in data ? data : null;
}

/** First pick of a calendar, or a change of mind: who in the house sees what. Starts on "only me". */
function SharingChooser({
  calendar,
  disabled,
  onSave,
  onCancel,
}: {
  calendar: CalendarView;
  disabled: boolean;
  onSave: (sharing: Sharing, together: boolean) => void;
  onCancel: () => void;
}) {
  const { dict } = useI18n();
  const copy = dict.calendars;
  const [sharing, setSharing] = useState<Sharing>(calendar.sharing ?? "private");
  const [together, setTogether] = useState(calendar.together);
  const name = `sharing-${calendar.id}`;

  return (
    <div className="px-4 pb-4">
      <fieldset>
        <legend className="pb-2 text-[13px] font-medium text-label-secondary">{copy.sharingTitle}</legend>
        <div className="overflow-hidden rounded-xl bg-fill">
          {(["private", "busy", "details"] as const).map((level, index) => (
            <label key={level} className={`flex min-h-12 cursor-pointer items-start gap-3 px-3.5 py-2.5 ${index > 0 ? "border-t border-separator" : ""}`}>
              <input
                type="radio"
                name={name}
                value={level}
                checked={sharing === level}
                onChange={() => setSharing(level)}
                className="mt-1 size-[18px] shrink-0 accent-[var(--accent)]"
              />
              <span className="min-w-0">
                <span className="block text-[16px] font-medium">{copy.sharing[level]}</span>
                <span className="block text-[13px] leading-snug text-label-secondary">{copy.sharingHint[level]}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {sharing !== "private" && (
        <div className="mt-3 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[16px] font-medium">{copy.together}</p>
            <p className="text-[13px] leading-snug text-label-secondary">{copy.togetherHint}</p>
          </div>
          <Switch checked={together} onChange={setTogether} label={copy.together} />
        </div>
      )}
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={onCancel} disabled={disabled} className={`${pill} flex-1 bg-surface text-label ring-1 ring-hairline`}>
          {dict.add.cancel}
        </button>
        <button type="button" onClick={() => onSave(sharing, sharing === "private" ? false : together)} disabled={disabled} className={`${pill} flex-1 bg-accent text-accent-contrast`}>
          {calendar.selected ? dict.add.save : copy.startSync}
        </button>
      </div>
    </div>
  );
}

function AccountBlock({ account, busy, preview, run }: { account: AccountView; busy: boolean; preview: boolean; run: (body: unknown) => Promise<void> }) {
  const { locale, dict } = useI18n();
  const copy = dict.calendars;
  const ago = useAgo();
  const [choosing, setChoosing] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const status =
    account.status === "reauth"
      ? copy.statusReauth
      : account.status === "error"
        ? copy.statusError
        : account.lastSyncedAt
          ? format(copy.statusSynced, { ago: ago(account.lastSyncedAt) })
          : copy.statusWaiting;
  const failing = account.status !== "active";

  return (
    <div className={rule}>
      <div className={row}>
        <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-fill text-[13px] font-bold">
          {account.provider === "google" ? "G" : "O"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-semibold">
            {dict.agenda.providers[account.provider]}
            {account.email && (
              <>
                <span className="text-label-tertiary"> · </span>
                <bdi className="font-normal [overflow-wrap:anywhere]">{account.email}</bdi>
              </>
            )}
          </p>
          <p role={failing ? "status" : undefined} className={`text-[13px] ${failing ? "text-danger" : "text-label-secondary"}`}>
            {status}
          </p>
        </div>
      </div>

      <ul>
        {account.calendars.map((calendar) => {
          const level = calendar.selected && calendar.sharing ? copy.sharing[calendar.sharing] : null;
          return (
            <li key={calendar.id} className="border-t border-separator/60">
              <div className={`${row} ps-6`}>
                <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ background: calendar.color ?? "var(--teal)" }} />
                <div className="min-w-0 flex-1">
                  <bdi className="align-ui block text-[16px] [overflow-wrap:anywhere]">{calendar.name}</bdi>
                  <p className="text-[13px] text-label-secondary">
                    {calendar.gone
                      ? copy.gone
                      : level
                        ? [level, calendar.together && calendar.sharing !== "private" ? copy.togetherShort : null].filter(Boolean).join(" · ")
                        : copy.notSynced}
                    {calendar.lastError && !calendar.gone && <span className="text-danger"> · {copy.calendarFailed}</span>}
                  </p>
                  {level && !calendar.gone && (
                    <button
                      type="button"
                      onClick={() => setChoosing(choosing === calendar.id ? null : calendar.id)}
                      disabled={busy}
                      className="-ms-1 min-h-9 px-1 text-[14px] font-medium text-accent disabled:opacity-40"
                    >
                      {copy.changeSharing}
                    </button>
                  )}
                </div>
                <Switch
                  checked={calendar.selected}
                  label={format(copy.syncCalendar, { name: calendar.name })}
                  onChange={(on) => {
                    if (busy || calendar.gone) return;
                    if (on) setChoosing(calendar.id);
                    else if (!preview) void run({ action: "choose", calendarId: calendar.id, selected: false, sharing: null, together: null });
                  }}
                />
              </div>
              {choosing === calendar.id && (
                <SharingChooser
                  calendar={calendar}
                  disabled={busy}
                  onCancel={() => setChoosing(null)}
                  onSave={(sharing, together) =>
                    preview
                      ? setChoosing(null)
                      : void run({ action: "choose", calendarId: calendar.id, selected: true, sharing, together }).then(() => setChoosing(null))
                  }
                />
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap gap-2 px-4 pb-4 pt-1">
        {account.status === "reauth" ? (
          <a
            href={preview ? undefined : `/api/calendars/connect/${account.provider}?lang=${locale}`}
            aria-disabled={preview}
            className={`${pill} bg-accent text-accent-contrast ${preview ? "pointer-events-none opacity-40" : ""}`}
          >
            {copy.reconnect}
          </a>
        ) : (
          <button type="button" onClick={() => void run({ action: "sync", scope: "mine" })} disabled={busy || preview} className={`${pill} bg-fill text-label`}>
            <RefreshCw aria-hidden size={15} strokeWidth={2.25} className={busy ? "motion-safe:animate-spin" : ""} />
            {copy.syncNow}
          </button>
        )}
        <button type="button" onClick={() => setConfirming(true)} disabled={busy || preview} className={`${pill} bg-fill text-danger`}>
          {copy.disconnect}
        </button>
      </div>
      <ConfirmPanel
        open={confirming}
        title={copy.disconnectTitle}
        body={copy.disconnectBody}
        confirm={copy.disconnect}
        failure={copy.failed}
        onCancel={() => setConfirming(false)}
        onConfirm={async () => {
          await run({ action: "disconnect", accountId: account.id });
          setConfirming(false);
        }}
      />
    </div>
  );
}

/**
 * Settings: this parent's Google and Outlook calendars. Read-only connections, each calendar picked one by one with an
 * explicit choice of what the house sees. Shows only what the server reports; nothing here pretends to be connected.
 */
export function CalendarsCard() {
  const { locale, dict } = useI18n();
  const copy = dict.calendars;
  const userId = useAuth((s) => s.session?.userId ?? null);
  const householdId = useAuth((s) => s.session?.householdId ?? null);
  const native = useSyncExternalStore(subscribeNever, isNativeApp, () => false);
  const [data, setData] = useState<Overview | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [returned, setReturned] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // Back from Google or Microsoft: say how it went once, and keep the address clean for a reload.
    const status = params.get("calendars");
    if (status) {
      params.delete("calendars");
      params.delete("account");
      const rest = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${rest ? `?${rest}` : ""}${window.location.hash}`);
    }
    let alive = true;
    const load: Promise<Overview> =
      process.env.NODE_ENV === "development" && params.has("calendarsPreview")
        ? Promise.resolve(previewOverview())
        : fetch("/api/calendars").then((response) =>
            response.ok ? (response.json() as Promise<Overview>) : Promise.reject(new Error(String(response.status))),
          );
    load
      .then((next) => alive && setData(next))
      .catch(() => alive && setLoadFailed(true))
      .finally(() => alive && status && setReturned(status));
    return () => {
      alive = false;
    };
  }, [userId]);

  const run = async (body: unknown) => {
    setBusy(true);
    setFailed(false);
    try {
      const next = await post(body);
      if (next) setData(next);
      if (userId && householdId) await reloadHouseCalendar(userId, householdId).catch(() => {});
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const setup = data?.setup;
  const preview = Boolean(data?.preview);
  const returnedText = returned ? (copy.returned as Record<string, string>)[returned] ?? copy.returned.failed : null;
  const connect = (provider: Provider) => {
    const ready = Boolean(setup?.[provider]) && !preview && !(native && provider === "google");
    const label = provider === "google" ? copy.connectGoogle : copy.connectOutlook;
    return ready ? (
      <a key={provider} href={`/api/calendars/connect/${provider}?lang=${locale}`} className={`${pill} bg-fill text-label`}>
        <ExternalLink aria-hidden size={15} className="rtl:-scale-x-100" />
        {label}
      </a>
    ) : (
      <span key={provider} aria-disabled="true" className={`${pill} cursor-not-allowed bg-fill text-label opacity-40`}>
        {label}
      </span>
    );
  };

  return (
    <div id="calendars" className="scroll-mt-6">
      <Card title={copy.title}>
        <div className="flex items-start gap-3 px-4 py-3.5">
          <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--teal)_16%,transparent)] text-teal">
            <CalendarSync size={18} strokeWidth={2.1} />
          </span>
          <p className="min-w-0 flex-1 text-[14px] leading-snug text-label-secondary">{copy.intro}</p>
        </div>

        {preview && (
          <p role="note" className={`${rule} bg-fill px-4 py-2.5 text-[13px] font-semibold text-label`}>
            {copy.previewBanner}
          </p>
        )}
        {returnedText && (
          <p role="status" className={`${rule} px-4 py-2.5 text-[14px] ${returned === "connected" ? "text-success" : "text-danger"}`}>
            {returnedText}
          </p>
        )}
        {failed && (
          <p role="alert" className={`${rule} px-4 py-2.5 text-[14px] text-danger`}>
            {copy.failed}
          </p>
        )}

        {!data && !loadFailed && <div aria-hidden className={`${rule} h-14`} />}
        {loadFailed && <p className={`${rule} px-4 py-3 text-[14px] text-label-secondary`}>{copy.loadFailed}</p>}

        {data?.accounts.map((account) => (
          <AccountBlock key={account.id} account={account} busy={busy} preview={preview} run={run} />
        ))}

        {setup && (
          <div className={`${rule} px-4 py-3.5`}>
            <p className="text-[13px] font-medium text-label-secondary">{data.accounts.length > 0 ? copy.addAnother : copy.connectTitle}</p>
            <div className="mt-2 flex flex-wrap gap-2">{(["google", "microsoft"] as const).map(connect)}</div>
            {!setup.ready || (!setup.google && !setup.microsoft) ? (
              <p className="mt-2 text-[13px] leading-snug text-label-secondary">
                {copy.notConfigured}
                {process.env.NODE_ENV === "development" && setup.missing.length > 0 && (
                  <span dir="ltr" className="mt-1 block font-mono text-[12px]">
                    {setup.missing.join(", ")}
                  </span>
                )}
              </p>
            ) : (
              (!setup.google || !setup.microsoft) && <p className="mt-2 text-[13px] leading-snug text-label-secondary">{copy.partlyConfigured}</p>
            )}
            {native && <p className="mt-2 text-[13px] leading-snug text-label-secondary">{copy.nativeNote}</p>}
          </div>
        )}

        <div className={`${rule} flex items-center gap-3 px-4 py-3`}>
          <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-fill text-[13px] font-bold text-label-tertiary">
            #
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[16px] font-medium text-label-secondary">Slack</p>
            <p className="text-[13px] leading-snug text-label-tertiary">{copy.slackLater}</p>
          </div>
          <span className="shrink-0 rounded-full bg-fill px-2.5 py-1 text-[12px] font-semibold text-label-secondary">{copy.later}</span>
        </div>
      </Card>
    </div>
  );
}
