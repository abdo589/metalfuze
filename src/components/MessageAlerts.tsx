import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useUnreadMessages } from "@/lib/unread-messages";
import { t } from "@/lib/i18n";
import { notificationPermission, requestNotificationPermission } from "@/lib/notification-permission";
import { useAuthSession } from "@/lib/auth-session";
import { useLiveRefresh } from "@/lib/live-refresh";
import { hasSalesStep, salesWaitingCount, setAppBadgeCount } from "@/lib/app-badge";

// Sales requests waiting on this account's approval step (RLS limits the rows it can see).
function useSalesWaiting(email?: string | null) {
  const [count, setCount] = useState<number | null>(null);
  const load = useCallback(async () => {
    if (!hasSalesStep(email)) { setCount(0); return; }
    const { data, error } = await supabase.from("sales_deals").select("workflow_step");
    if (!error) setCount(salesWaitingCount((data ?? []).map((d) => d.workflow_step as string), email));
  }, [email]);
  useEffect(() => { setCount(null); void load(); }, [load]);
  useLiveRefresh(["sales_deals"], load);
  return count;
}

// Pops an alert (in-app + browser notification) when a new direct message arrives,
// and shows the unread count in the browser tab title.
export function MessageAlerts() {
  const session = useAuthSession();
  const userId = session?.user.id;
  const salesWaiting = useSalesWaiting(session?.user.email);
  const unread = useUnreadMessages();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    const base = document.title.replace(/^\(\d+\+?\)\s*/, "");
    const total = unread + (salesWaiting ?? 0);
    document.title = total > 0 ? `(${total > 99 ? "99+" : total}) ${base}` : base;
  }, [unread, salesWaiting, path]);

  // Red counter on the laptop/phone icon (browser tab + installed app taskbar icon).
  useEffect(() => { setAppBadgeCount(unread + (salesWaiting ?? 0)); }, [unread, salesWaiting]);

  // System notification when a new sales request reaches this account's step.
  const lastWaiting = useRef<number | null>(null);
  useEffect(() => {
    const prev = lastWaiting.current;
    lastWaiting.current = salesWaiting;
    if (salesWaiting === null || prev === null || salesWaiting <= prev) return;
    if (window.location.pathname !== "/sales") {
      toast.info(t("طلب مبيعات بانتظارك"), { action: { label: t("فتح"), onClick: () => navigate({ to: "/sales" }) } });
    }
    if (notificationPermission() === "granted" && (document.hidden || !document.hasFocus())) {
      try {
        const n = new Notification("Metal Fuze", { body: `${t("طلب مبيعات بانتظارك")} (${salesWaiting})`, icon: "/icon-192.png", tag: "sales-waiting" });
        n.onclick = () => { window.focus(); navigate({ to: "/sales" }); n.close(); };
      } catch { /* unsupported */ }
    }
  }, [salesWaiting, navigate]);

  useEffect(() => {
    if (!userId) return;
    if (notificationPermission() === "default") void requestNotificationPermission();
    const me = userId;
    const ch = supabase.channel(`dm-alert-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages" }, async (payload) => {
        const row = payload.new as { recipient_id: string; body: string; attachment_name?: string | null };
        if (!me || row.recipient_id !== me) return;
        const { count } = await supabase.from("direct_messages").select("id", { count: "exact", head: true })
          .eq("recipient_id", me).is("read_at", null);
        const text = row.attachment_name ? `📎 ${row.attachment_name}` : row.body.slice(0, 80);
        const title = `${t("رسالة جديدة")} — ${count ?? 1} ${t("غير مقروءة")}`;
        if (window.location.pathname !== "/messages") {
          toast.info(title, { description: text, action: { label: t("فتح"), onClick: () => navigate({ to: "/messages" }) } });
        }
        // System notification outside the app whenever the window isn't in front.
        if ("Notification" in window && Notification.permission === "granted" && (document.hidden || !document.hasFocus())) {
          let sender = "";
          try {
            const sid = (payload.new as { sender_id?: string }).sender_id;
            const { data: dir } = await supabase.rpc("chat_directory");
            sender = (dir as { id: string; display_name: string }[] | null)?.find((p) => p.id === sid)?.display_name ?? "";
          } catch { /* ignore */ }
          try {
            const n = new Notification(sender ? `${sender} — ${t("رسالة جديدة")}` : title, { body: text, icon: "/icon-192.png", tag: "dm" });
            n.onclick = () => { window.focus(); navigate({ to: "/messages" }); n.close(); };
          } catch { /* ignore */ }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [navigate, userId]);

  return null;
}
