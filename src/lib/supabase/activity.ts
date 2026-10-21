"use client";

import { isActivityKind, type ActivityItem, type ActivityKind } from "@/lib/activity";
import { createBrowserSupabase } from "./browser";
import { supabaseConfigured } from "./env";

type Row = { id: string; actor_id: string; kind: string; subject_id: string | null; title: string; created_at: string };

const toItem = (row: Row): ActivityItem | null =>
  isActivityKind(row.kind)
    ? { id: row.id, actorId: row.actor_id, kind: row.kind, subjectId: row.subject_id, title: row.title, createdAt: row.created_at }
    : null;

/** Logs what this parent just did (for the bell) and notifies the other parent's iPhone. Fire and forget. */
export function announce(kind: ActivityKind, subjectId: string, title: string) {
  if (!supabaseConfigured()) return;
  void fetch("/api/activity", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind, subjectId, title }),
  }).catch(() => {});
}

/** The latest activity and when this parent last opened the bell. Throws when offline, so the bell keeps what it has. */
export async function loadActivity(householdId: string, userId: string) {
  const db = createBrowserSupabase();
  const [feed, profile] = await Promise.all([
    db.from("activity").select("id, actor_id, kind, subject_id, title, created_at").eq("household_id", householdId).order("created_at", { ascending: false }).limit(50),
    db.from("profiles").select("activity_seen_at").eq("id", userId).maybeSingle(),
  ]);
  if (feed.error) throw feed.error;
  return {
    items: (feed.data as Row[]).map(toItem).filter((item): item is ActivityItem => item !== null),
    seenAt: (profile.data?.activity_seen_at as string | null | undefined) ?? null,
  };
}

export function watchActivity(householdId: string, { onItem, onReconnect }: { onItem: (item: ActivityItem) => void; onReconnect: () => void }) {
  if (!supabaseConfigured()) return () => {};
  const db = createBrowserSupabase();
  const channel = db
    .channel(`activity-${householdId}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity", filter: `household_id=eq.${householdId}` }, (payload) => {
      const item = toItem(payload.new as Row);
      if (item) onItem(item);
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") onReconnect();
    });
  return () => {
    void db.removeChannel(channel);
  };
}

export async function markActivitySeen(userId: string, at: string) {
  if (!supabaseConfigured()) return;
  await createBrowserSupabase().from("profiles").update({ activity_seen_at: at }).eq("id", userId);
}
