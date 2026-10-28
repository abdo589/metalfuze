import { useEffect } from "react";
import { toast } from "sonner";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useUnreadMessages } from "@/lib/unread-messages";
import { t } from "@/lib/i18n";

// Pops an alert (in-app + browser notification) when a new direct message arrives,
// and shows the unread count in the browser tab title.
export function MessageAlerts() {
  const unread = useUnreadMessages();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    const base = document.title.replace(/^\(\d+\)\s*/, "");
    document.title = unread > 0 ? `(${unread}) ${base}` : base;
  }, [unread, path]);

  // App icon badge (installed app on phone/desktop) showing the unread count.
  useEffect(() => {
    const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    try {
      if (unread > 0) nav.setAppBadge?.(unread)?.catch(() => {});
      else nav.clearAppBadge?.()?.catch(() => {});
    } catch { /* unsupported */ }
  }, [unread]);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => {});
    let me: string | null = null;
    supabase.auth.getUser().then(({ data }) => { me = data.user?.id ?? null; });
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
  }, [navigate]);

  return null;
}
