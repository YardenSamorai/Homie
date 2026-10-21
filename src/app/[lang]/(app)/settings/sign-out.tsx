"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/dictionary-provider";
import { useAuth } from "@/lib/auth/session";
import { useActivity } from "@/lib/activity-store";
import { useHousehold } from "@/lib/household-store";
import { forgetPush } from "@/lib/push/client";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { supabaseConfigured } from "@/lib/supabase/env";

export function SignOut() {
  const { locale, dict } = useI18n();
  const router = useRouter();
  const email = useAuth((s) => s.session?.email);
  const signOut = useAuth((s) => s.signOut);
  const syncSelf = useHousehold((s) => s.syncSelf);
  const clearActivity = useActivity((s) => s.clear);
  const [busy, setBusy] = useState(false);

  const leave = async () => {
    setBusy(true);
    if (supabaseConfigured()) {
      await forgetPush().catch(() => {});
      await createBrowserSupabase().auth.signOut();
    }
    clearActivity();
    syncSelf(null);
    signOut();
    router.replace(`/${locale}/login`);
  };

  return (
    <div className="flex flex-col px-4 py-3">
      {email && <p className="text-[15px] text-label-secondary">{email}</p>}
      <p className="mt-1 text-[13px] leading-snug text-label-tertiary">{dict.settings.signOutHint}</p>
      <button
        type="button"
        onClick={() => void leave()}
        disabled={busy}
        className="mt-3 min-h-11 self-start text-[17px] font-medium text-danger active:opacity-60 disabled:opacity-40"
      >
        {dict.settings.signOut}
      </button>
    </div>
  );
}
