import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "./auth-session";
import { useLiveRefresh } from "./live-refresh";

const pending = new Map<string, Promise<number>>();
function unreadCount(userId: string) {
  const existing = pending.get(userId);
  if (existing) return existing;
  const request = Promise.resolve(supabase.from("direct_messages")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", userId).is("read_at", null))
    .then(({ count, error }) => { if (error) throw error; return count ?? 0; })
    .finally(() => { if (pending.get(userId) === request) pending.delete(userId); });
  pending.set(userId, request);
  return request;
}

// Live count of unread direct messages for the signed-in user.
// Subscribes to realtime changes on direct_messages so the badge
// updates the moment a message arrives or is marked as read.
export function useUnreadMessages() {
  const userId = useAuthSession()?.user.id;
  const activeUser = useRef(userId);
  activeUser.current = userId;
  const [result, setResult] = useState<{ userId: string; count: number } | null>(null);
  const refresh = async () => {
    if (!userId) return;
    try {
      const count = await unreadCount(userId);
      if (activeUser.current === userId) setResult({ userId, count });
    } catch { /* Keep last successful count. */ }
  };
  useLiveRefresh(["direct_messages"], refresh);

  useEffect(() => {
    let alive = true;
    if (userId) void unreadCount(userId).then((count) => { if (alive) setResult({ userId, count }); }, () => {});
    return () => { alive = false; };
  }, [userId]);

  return result?.userId === userId ? result?.count ?? 0 : 0;
}
