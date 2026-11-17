import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useUnreadMessages } from "@/lib/unread-messages";
import { t } from "@/lib/i18n";
import { notificationPermission, requestNotificationPermission } from "@/lib/notification-permission";
import { useAuthSession } from "@/lib/auth-session";
import { useLiveRefresh } from "@/lib/live-refresh";
import { answersMeetings, hasSalesStep, leavesWaitingCount, meetingsWaitingCount, salesWaitingCount, setAppBadgeCount } from "@/lib/app-badge";

type Waiting = { sales: number; leaves: number; meetings: number };
const WAIT_LINKS = [
  { k: "sales", to: "/sales", label: "طلب مبيعات بانتظارك" },
  { k: "leaves", to: "/leaves", label: "طلب إجازة بانتظار موافقتك" },
  { k: "meetings", to: "/meetings", label: "دعوة اجتماع بانتظار ردك" },
] as const;

// Items waiting on this account (each account sees only its own; RLS limits the rows).
function useWaiting(userId?: string, email?: string | null) {
  const [w, setW] = useState<Waiting | null>(null);
  const load = useCallback(async () => {
    if (!userId) { setW(null); return; }
    const [sales, leaves, meetings] = await Promise.all([
      hasSalesStep(email)
        ? supabase.from("sales_deals").select("workflow_step").then(({ data, error }) => error ? null : salesWaitingCount((data ?? []).map((d) => d.workflow_step as string), email))
        : Promise.resolve(0),
      supabase.rpc("leave_can_approve", { _uid: userId }).then(async ({ data: ok }) => {
        if (!ok) return 0;
        const { data, error } = await supabase.from("leave_requests").select("status").in("status", ["pending_manager", "pending_hr"]);
        return error ? null : leavesWaitingCount((data ?? []).map((r) => r.status), true);
      }, () => 0),
      answersMeetings(email)
        ? Promise.all([
            supabase.from("sales_meetings").select("id,meeting_at,attendees").contains("attendees", [email!.toLowerCase()]).gte("meeting_at", new Date().toISOString()),
            supabase.from("sales_meeting_responses").select("meeting_id").eq("user_id", userId),
          ]).then(([m, r]) => m.error ? null : meetingsWaitingCount(m.data ?? [], new Set((r.data ?? []).map((x) => x.meeting_id)), email, Date.now()))
        : Promise.resolve(0),
    ]);
    setW((prev) => ({ sales: sales ?? prev?.sales ?? 0, leaves: leaves ?? prev?.leaves ?? 0, meetings: meetings ?? prev?.meetings ?? 0 }));
  }, [userId, email]);
  useEffect(() => { setW(null); void load(); }, [load]);
  useLiveRefresh(["sales_deals", "leave_requests", "sales_meetings", "sales_meeting_responses"], load);
  return w;
}

// Pops an alert (in-app + browser notification) when a new direct message arrives,
// and shows the unread count in the browser tab title.
export function MessageAlerts() {
  const session = useAuthSession();
  const userId = session?.user.id;
  const waiting = useWaiting(userId, session?.user.email);
  const waitingTotal = waiting ? waiting.sales + waiting.leaves + waiting.meetings : 0;
  const unread = useUnreadMessages();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    const base = document.title.replace(/^\(\d+\+?\)\s*/, "");
    const total = unread + waitingTotal;
    document.title = total > 0 ? `(${total > 99 ? "99+" : total}) ${base}` : base;
  }, [unread, waitingTotal, path]);

  // Red counter on the laptop/phone icon (browser tab + installed app taskbar icon).
  useEffect(() => { setAppBadgeCount(unread + waitingTotal); }, [unread, waitingTotal]);

  // System notification when something new reaches this account (sales step, leave approval, meeting invite).
  const lastWaiting = useRef<Waiting | null>(null);
  useEffect(() => {
    const prev = lastWaiting.current;
    lastWaiting.current = waiting;
    if (!waiting || !prev) return;
    for (const l of WAIT_LINKS) {
      const n = waiting[l.k];
      if (n <= prev[l.k]) continue;
      if (window.location.pathname !== l.to) {
        toast.info(t(l.label), { action: { label: t("فتح"), onClick: () => navigate({ to: l.to }) } });
      }
      if (notificationPermission() === "granted" && (document.hidden || !document.hasFocus())) {
        try {
          const note = new Notification("Metal Fuze", { body: `${t(l.label)} (${n})`, icon: "/icon-192.png", tag: `waiting-${l.k}` });
          note.onclick = () => { window.focus(); navigate({ to: l.to }); note.close(); };
        } catch { /* unsupported */ }
      }
    }
  }, [waiting, navigate]);

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
