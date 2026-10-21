"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
import { useAuth } from "@/lib/auth/session";
import { useHousehold } from "@/lib/household-store";
import { supabaseConfigured } from "@/lib/supabase/env";
import { leaveHousehold, removeHouseholdMember, transferAdmin } from "@/lib/supabase/members";
import type { Member } from "@/lib/tasks";
import { ConfirmPanel } from "./confirm-panel";

type Pending = { id: string; action: "remove" | "admin" | "leave" } | null;

const first = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/**
 * The house's people. The admin can hand the home over or remove the other parent; anyone can leave.
 * Each asks first, saying what happens.
 */
export function HouseholdCard() {
  const { locale, dict } = useI18n();
  const router = useRouter();
  const members = useHousehold((s) => s.members);
  const selfId = useHousehold((s) => s.currentUserId);
  const role = useAuth((s) => s.session?.role);
  const [pending, setPending] = useState<Pending>(null);
  const live = supabaseConfigured();
  if (members.length === 0) return <div aria-hidden className="h-14" />;

  const admin = role === "admin";
  const partner = members.find((member) => member.id !== selfId);
  const copy = dict.prefs;

  const remove = async (member: Member) => {
    await removeHouseholdMember(member.id);
    const { tasks, setRoster, replaceLists, shopping, events } = useHousehold.getState();
    setRoster(selfId, members.filter((m) => m.id !== member.id));
    replaceLists({
      shopping,
      events,
      tasks: tasks.map((task) => (task.assigneeId === member.id && !task.completedAt ? { ...task, assigneeId: selfId } : task)),
    });
    setPending(null);
  };

  const handOver = async (member: Member) => {
    await transferAdmin(member.id);
    useAuth.getState().patch({ role: "member" });
    setPending(null);
  };

  // The home is no longer this parent's: start over at setup or join, like after being removed.
  const leave = async () => {
    await leaveHousehold();
    useAuth.getState().patch({ householdId: null, householdName: null, role: null });
    useHousehold.getState().syncSelf(null);
    router.replace(`/${locale}/setup`);
  };

  return (
    <ul>
      {members.map((member, index) => {
        const self = member.id === selfId;
        const open = pending?.id === member.id ? pending.action : null;
        return (
          <li key={member.id} className={index === members.length - 1 ? "" : "border-b border-separator"}>
            <div className="flex min-h-14 items-center gap-3 px-4">
              <Avatar member={member} size={36} />
              <span className="min-w-0 flex-1 truncate text-[17px]">
                <bdi>{member.name}</bdi>
                {self && <span className="ms-2 text-[15px] text-label-secondary">{dict.settings.you}</span>}
              </span>
              {live && !open && (
                <span className="flex shrink-0 items-center gap-3">
                  {admin && !self && (
                    <button type="button" onClick={() => setPending({ id: member.id, action: "admin" })} className="min-h-11 px-1 text-[15px] font-medium text-accent active:opacity-60">
                      {copy.makeAdmin}
                    </button>
                  )}
                  {admin && !self && (
                    <button type="button" onClick={() => setPending({ id: member.id, action: "remove" })} className="min-h-11 px-1 text-[15px] font-medium text-danger active:opacity-60">
                      {dict.settings.removeMember}
                    </button>
                  )}
                  {self && (
                    <button type="button" onClick={() => setPending({ id: member.id, action: "leave" })} className="min-h-11 px-1 text-[15px] font-medium text-danger active:opacity-60">
                      {copy.leave}
                    </button>
                  )}
                </span>
              )}
            </div>
            <ConfirmPanel
              open={open === "remove"}
              title={format(dict.settings.removeTitle, { name: first(member.name) })}
              body={format(dict.settings.removeBody, { name: first(member.name) })}
              confirm={dict.settings.removeConfirm}
              failure={dict.settings.removeFailed}
              onConfirm={() => remove(member)}
              onCancel={() => setPending(null)}
            />
            <ConfirmPanel
              open={open === "admin"}
              destructive={false}
              title={format(copy.makeAdminTitle, { name: first(member.name) })}
              body={copy.makeAdminBody}
              confirm={copy.makeAdminConfirm}
              failure={copy.actionFailed}
              onConfirm={() => handOver(member)}
              onCancel={() => setPending(null)}
            />
            <ConfirmPanel
              open={open === "leave"}
              title={copy.leaveTitle}
              body={partner ? format(copy.leaveBody, { name: first(partner.name) }) : copy.leaveAlone}
              confirm={copy.leaveConfirm}
              failure={copy.actionFailed}
              onConfirm={leave}
              onCancel={() => setPending(null)}
            />
          </li>
        );
      })}
    </ul>
  );
}
