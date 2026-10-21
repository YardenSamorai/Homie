"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Avatar } from "@/components/ui/avatar";
import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
import { useAuth } from "@/lib/auth/session";
import { useHousehold } from "@/lib/household-store";
import { easeOut } from "@/lib/motion";
import { supabaseConfigured } from "@/lib/supabase/env";
import { removeHouseholdMember } from "@/lib/supabase/members";
import type { Member } from "@/lib/tasks";

/** The house's people. The admin can remove the other parent, after saying so twice. */
export function HouseholdCard() {
  const members = useHousehold((s) => s.members);
  const selfId = useHousehold((s) => s.currentUserId);
  const admin = useAuth((s) => s.session?.role === "admin");
  const [confirming, setConfirming] = useState<string | null>(null);
  if (members.length === 0) return <div aria-hidden className="h-14" />;

  return (
    <ul>
      {members.map((member, index) => (
        <MemberRow
          key={member.id}
          member={member}
          self={member.id === selfId}
          removable={admin && member.id !== selfId && supabaseConfigured()}
          last={index === members.length - 1}
          confirming={confirming === member.id}
          onConfirm={(open) => setConfirming(open ? member.id : null)}
        />
      ))}
    </ul>
  );
}

function MemberRow({
  member,
  self,
  removable,
  last,
  confirming,
  onConfirm,
}: {
  member: Member;
  self: boolean;
  removable: boolean;
  last: boolean;
  confirming: boolean;
  onConfirm: (open: boolean) => void;
}) {
  const { dict } = useI18n();
  const copy = dict.settings;
  const selfId = useHousehold((s) => s.currentUserId);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const remove = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await removeHouseholdMember(member.id);
      const { members, tasks, setRoster, replaceLists, shopping, events } = useHousehold.getState();
      setRoster(selfId, members.filter((m) => m.id !== member.id));
      replaceLists({
        shopping,
        events,
        tasks: tasks.map((task) => (task.assigneeId === member.id && !task.completedAt ? { ...task, assigneeId: selfId } : task)),
      });
      onConfirm(false);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className={last ? "" : "border-b border-separator"}>
      <div className="flex min-h-14 items-center gap-3 px-4">
        <Avatar member={member} size={36} />
        <span className="min-w-0 flex-1 truncate text-[17px]">
          <bdi>{member.name}</bdi>
          {self && <span className="ms-2 text-[15px] text-label-secondary">{copy.you}</span>}
        </span>
        {removable && !confirming && (
          <button
            type="button"
            onClick={() => onConfirm(true)}
            className="min-h-11 shrink-0 px-1 text-[15px] font-medium text-danger active:opacity-60"
          >
            {copy.removeMember}
          </button>
        )}
      </div>
      <AnimatePresence initial={false}>
        {confirming && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: easeOut }}
            className="overflow-hidden"
          >
            <div role="alertdialog" aria-labelledby={`remove-${member.id}`} className="px-4 pb-4">
              <p id={`remove-${member.id}`} className="text-[15px] font-semibold">
                {format(copy.removeTitle, { name: member.name })}
              </p>
              <p className="mt-1 text-[13px] leading-snug text-label-secondary">
                {failed ? copy.removeFailed : format(copy.removeBody, { name: member.name })}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => onConfirm(false)}
                  disabled={busy}
                  className="min-h-11 flex-1 rounded-full bg-fill text-[15px] font-semibold text-label transition-transform duration-150 ease-out active:scale-[0.97]"
                >
                  {copy.removeCancel}
                </button>
                <button
                  type="button"
                  onClick={() => void remove()}
                  disabled={busy}
                  className="min-h-11 flex-1 rounded-full bg-danger text-[15px] font-semibold text-white transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-60"
                >
                  {copy.removeConfirm}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}
