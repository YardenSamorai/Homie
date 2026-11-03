"use client";

import { Avatar } from "@/components/ui/avatar";
import { useAgo } from "@/components/shell/activity";
import { useI18n } from "@/i18n/dictionary-provider";
import { activityLine } from "@/lib/activity";
import { useActivity } from "@/lib/activity-store";
import { addDays, toDayKey, type DayKey } from "@/lib/dates";
import { firstName } from "@/lib/day-story";
import { useHousehold } from "@/lib/household-store";

const SHOWN = 2;

/**
 * The last thing or two the other parent did today or yesterday, from the bell's own feed.
 * The viewer's own doings aren't news.
 */
export function RecentActivity({ selfId, today, compact = false, fallback = null }: { selfId: string; today: DayKey; compact?: boolean; fallback?: React.ReactNode }) {
  const { dict } = useI18n();
  const items = useActivity((s) => s.items);
  const show = useActivity((s) => s.show);
  const members = useHousehold((s) => s.members);
  const ago = useAgo();
  const since = addDays(today, -1);
  const recent = items.filter((item) => item.actorId !== selfId && toDayKey(new Date(item.createdAt)) >= since).slice(0, compact ? 1 : SHOWN);
  if (recent.length === 0) return fallback;

  return (
    <section aria-labelledby="recent-activity">
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 id="recent-activity" className="text-[15px] font-semibold text-label-secondary">
          {dict.agenda.recent}
        </h2>
        <button type="button" onClick={() => show(selfId)} className="min-h-11 px-1 text-[15px] font-medium text-accent">
          {dict.agenda.recentAll}
        </button>
      </div>
      <ul className="flex flex-col">
        {recent.map((item) => {
          const member = members.find((m) => m.id === item.actorId);
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => show(selfId)}
                className="-mx-1 flex min-h-11 w-[calc(100%+0.5rem)] items-center gap-2.5 rounded-xl px-1 py-1.5 text-start transition-colors duration-150 active:bg-fill"
              >
                {member && <Avatar member={member} size={26} />}
                <span className="min-w-0 flex-1 text-[15px] leading-snug [overflow-wrap:anywhere]">
                  {member && (
                    <>
                      <bdi className="font-semibold">{firstName(member.name)}</bdi>
                      <span className="text-label-tertiary"> · </span>
                    </>
                  )}
                  <bdi>{activityLine(dict.activity.kinds, item.kind, item.title)}</bdi>
                </span>
                <span className="shrink-0 text-[13px] text-label-tertiary">{ago(item.createdAt)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
