"use client";

import { useEffect, useState } from "react";
import { btnPrimarySm } from "@/components/ui/button";
import { useI18n } from "@/i18n/dictionary-provider";
import { authApi } from "@/lib/auth/api";
import { useAuth } from "@/lib/auth/session";
import { useOnlineStatus } from "@/lib/use-online-status";

export function HouseholdName() {
  const { dict } = useI18n();
  const session = useAuth((s) => s.session);
  const patch = useAuth((s) => s.patch);
  const online = useOnlineStatus();
  const saved = session?.householdName ?? "";
  const [name, setName] = useState(saved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const canEdit = session?.role !== "member";
  const clean = name.trim();
  const dirty = clean.length > 0 && clean !== saved;

  useEffect(() => {
    setName(saved);
  }, [saved]);

  const save = async () => {
    if (!session?.householdId || !dirty) return;
    if (!online) return setError(dict.auth.errors.offline);
    setBusy(true);
    setError(null);
    setDone(false);
    patch({ householdName: clean });
    try {
      const house = await authApi.renameHousehold(session.householdId, session.userId, clean);
      patch({ householdName: house.name });
      setName(house.name);
    } catch {
      /* Session already has the new name until the house is on the server. */
    } finally {
      setDone(true);
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      {canEdit ? (
        <input
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setDone(false);
            setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void save();
            }
          }}
          aria-label={dict.settings.homeName}
          maxLength={60}
          className="h-12 w-full rounded-xl bg-fill px-4 text-[17px] text-label outline-none placeholder:text-label-tertiary"
        />
      ) : (
        <p className="min-h-12 text-[17px] leading-[48px]">{saved || dict.settings.household}</p>
      )}
      <p className="text-[13px] leading-snug text-label-secondary">{dict.settings.homeNameHint}</p>
      {error && <p className="text-[13px] text-danger">{error}</p>}
      {canEdit && (
        <button type="button" disabled={busy || !dirty} onClick={() => void save()} className={`${btnPrimarySm} self-start`}>
          {done ? dict.settings.renamed : dict.settings.rename}
        </button>
      )}
    </div>
  );
}
