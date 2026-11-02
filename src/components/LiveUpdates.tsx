import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { readCache } from "@/lib/read-cache";
import { refreshLiveReaders } from "@/lib/live-refresh";

/** One session-scoped channel for the whole app; table readers own their drafts. */
export function LiveUpdates() {
  const queries = useQueryClient();
  useEffect(() => {
    let alive = true;
    let userId: string | null = null;
    let channel: ReturnType<typeof supabase.channel> | undefined;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const changed = new Set<string>();
    const flush = () => {
      if (!alive || document.visibilityState !== "visible" || !navigator.onLine || !userId) return;
      for (const table of changed) { readCache.clearTable(table); refreshLiveReaders(table); }
      changed.clear();
      void queries.invalidateQueries({ refetchType: "active" });
    };
    const refresh = () => {
      if (!alive || !userId || document.visibilityState !== "visible" || !navigator.onLine) return;
      readCache.clearAll();
      refreshLiveReaders();
      void queries.invalidateQueries({ refetchType: "active" });
    };
    const connect = (id: string | null) => {
      if (!alive || userId === id) return;
      userId = id;
      if (channel) { void supabase.removeChannel(channel); channel = undefined; }
      clearTimeout(debounce); changed.clear(); readCache.clearAll();
      if (!id) return;
      channel = supabase.channel(`app-live-${id}-${Math.random().toString(36).slice(2)}`)
        .on("postgres_changes", { event: "*", schema: "public" }, (payload) => {
          changed.add(payload.table);
          clearTimeout(debounce);
          debounce = setTimeout(flush, 200);
        }).subscribe((status) => { if (status === "SUBSCRIBED") refresh(); });
    };
    void supabase.auth.getSession().then(({ data }) => connect(data.session?.user.id ?? null));
    const { data: auth } = supabase.auth.onAuthStateChange((_event, session) => connect(session?.user.id ?? null));
    const interval = setInterval(refresh, 15000);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    const onWrite = (event: Event) => {
      const table = (event as CustomEvent<string>).detail;
      changed.add(table); clearTimeout(debounce); debounce = setTimeout(flush, 200);
    };
    window.addEventListener("metalfuze:table-written", onWrite);
    return () => {
      alive = false; clearInterval(interval); clearTimeout(debounce);
      auth.subscription.unsubscribe(); if (channel) void supabase.removeChannel(channel);
      window.removeEventListener("online", refresh);
      window.removeEventListener("metalfuze:table-written", onWrite);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [queries]);
  return null;
}