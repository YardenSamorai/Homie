"use client";

import { useId, useState } from "react";
import { Card } from "@/components/ui/card";
import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
import { useAuth } from "@/lib/auth/session";
import { firstName } from "@/lib/day-story";
import { useHousehold } from "@/lib/household-store";
import { periodFor } from "@/lib/period";
import { usePrefs } from "@/lib/prefs-store";
import { supabaseConfigured } from "@/lib/supabase/env";
import { answerShare, offerOf, sendLook, useIncomingShare, withOffer } from "@/lib/supabase/look-shares";
import { useLook } from "@/lib/theme";
import { useClock } from "@/lib/use-clock";
import { LookPreview } from "./look-preview";

const button = "min-h-11 rounded-full px-4 text-[15px] font-semibold transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-40";

/** Offering this parent's saved look to the other, and answering one they offered. Nothing applies by itself. */
export function ShareLookCard() {
  const { dict } = useI18n();
  const copy = dict.share;
  const userId = useAuth((s) => s.session?.userId) ?? "";
  const partner = useHousehold((s) => s.members.find((member) => member.id !== s.currentUserId));
  const sender = useHousehold((s) => s.members);
  const look = useLook();
  const commit = usePrefs((s) => s.commit);
  const clock = useClock();
  const [withDensity, setWithDensity] = useState(false);
  const [sent, setSent] = useState<"idle" | "busy" | "sent" | "failed">("idle");
  const [answer, setAnswer] = useState<"idle" | "busy" | "applied" | "failed">("idle");
  const { share, clear } = useIncomingShare();
  const densityId = useId();

  if (!supabaseConfigured()) return null;
  const from = share ? sender.find((member) => member.id === share.from) : undefined;
  const fromName = from ? firstName(from.name) : copy.partnerFallback;
  const offered = share ? withOffer(look, share.offered) : null;

  const send = async () => {
    if (!partner) return;
    setSent("busy");
    setSent((await sendLook(partner.id, offerOf(look, withDensity))) ? "sent" : "failed");
  };
  const apply = async () => {
    if (!share || !offered) return;
    setAnswer("busy");
    const result = await commit(userId, { ...usePrefs.getState().prefs, look: offered });
    if (result !== "saved") {
      setAnswer("failed");
      return;
    }
    await answerShare(share.id, true);
    setAnswer("applied");
    clear();
  };
  const decline = async () => {
    if (!share) return;
    await answerShare(share.id, false);
    clear();
  };

  return (
    <>
      {share && offered && (
        <Card title={format(copy.incomingTitle, { name: fromName })}>
          <div className="flex flex-col gap-3 p-3">
            <LookPreview look={offered} photoUrl={null} period={clock ? periodFor(clock.hour) : "morning"} frame="phone" height="h-[220px]" />
            <p className="px-1 text-[15px] leading-snug text-label-secondary">{copy.incomingBody}</p>
            {!share.offered.background && <p className="px-1 text-[13px] leading-snug text-label-secondary">{format(copy.photoNote, { name: fromName })}</p>}
            {answer === "failed" && (
              <p role="alert" className="px-1 text-[13px] text-danger">
                {copy.applyFailed}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={answer === "busy"} onClick={() => void apply()} className={`${button} bg-accent text-accent-contrast`}>
                {copy.apply}
              </button>
              <button type="button" disabled={answer === "busy"} onClick={() => void decline()} className={`${button} bg-fill`}>
                {copy.decline}
              </button>
            </div>
          </div>
        </Card>
      )}
      <Card title={copy.title}>
        {partner ? (
          <div className="flex flex-col gap-3 p-4">
            <p className="text-[15px] leading-snug text-label-secondary">{format(copy.lead, { name: firstName(partner.name) })}</p>
            <p className="text-[13px] leading-snug text-label-secondary">{copy.includes}</p>
            <label htmlFor={densityId} className="flex min-h-11 items-center gap-3 text-[17px]">
              <input id={densityId} type="checkbox" checked={withDensity} onChange={(event) => setWithDensity(event.target.checked)} className="size-5 accent-[var(--accent)]" />
              {copy.density}
            </label>
            <button type="button" disabled={sent === "busy"} onClick={() => void send()} className={`${button} self-start bg-accent text-accent-contrast`}>
              {format(copy.send, { name: firstName(partner.name) })}
            </button>
            <p aria-live="polite" className={`text-[13px] ${sent === "failed" ? "text-danger" : "text-label-secondary"}`}>
              {sent === "sent" ? format(copy.sent, { name: firstName(partner.name) }) : sent === "failed" ? copy.failed : answer === "applied" ? copy.applied : ""}
            </p>
          </div>
        ) : (
          <p className="p-4 text-[15px] leading-snug text-label-secondary">{copy.noPartner}</p>
        )}
      </Card>
    </>
  );
}
