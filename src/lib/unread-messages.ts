import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Live count of unread direct messages for the signed-in user.
// Subscribes to realtime changes on direct_messages so the badge
// updates the moment a message arrives or is marked as read.
export function useUnreadMessages() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;

    async function refresh() {
      const { data: u } = await supabase.auth.getUser();
      if (!alive || !u.user) { if (alive) setCount(0); return; }
      const { count: n } = await supabase
        .from("direct_messages")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", u.user.id)
        .is("read_at", null);
      if (alive) setCount(n ?? 0);
    }

    refresh();
    // Unique name per hook instance: the sidebar renders twice (desktop + mobile),
    // and reusing a topic returns the already-subscribed channel, which throws on .on().
    const ch = supabase.channel(`dm-badge-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "direct_messages" }, refresh)
      .subscribe();

    return () => { alive = false; supabase.removeChannel(ch); };
  }, []);

  return count;
}
