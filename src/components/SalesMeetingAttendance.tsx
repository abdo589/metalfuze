import { useCallback, useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { t, locale, useLanguage } from "@/lib/i18n";
import { canRespondToMeeting, REQUIRED_MEETING_PEOPLE, responseForPerson } from "@/lib/sales-meetings";

type Meeting = Tables<"sales_meetings">;
export function SalesMeetingAttendance({ meetings, onRefresh }: { meetings: Meeting[]; onRefresh: () => void }) {
  useLanguage();
  const [responses, setResponses] = useState<Tables<"sales_meeting_responses">[]>([]);
  const [me, setMe] = useState<{ email: string; confirmed: boolean } | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setMe(data.user ? { email: data.user.email ?? "", confirmed: !!data.user.email_confirmed_at } : null)); }, []);
  useEffect(() => {
    if (!meetings.length) { setResponses([]); return; }
    let alive = true;
    supabase.from("sales_meeting_responses").select("*").in("meeting_id", meetings.map((m) => m.id)).then(({ data, error }) => {
      if (!alive) return;
      if (error) toast.error(t("تعذر تحميل ردود الاجتماعات"));
      else setResponses(data ?? []);
    });
    return () => { alive = false; };
  }, [meetings]);
  async function respond(id: string, response: "accepted" | "declined") {
    setBusy(id);
    const { error } = await supabase.rpc("sales_meeting_respond", { p_meeting: id, p_response: response, p_note: notes[id] ?? "" });
    setBusy(null);
    if (error) { toast.error(t("تعذر الحفظ، حاول مرة أخرى")); return; }
    toast.success(t("تم تسجيل ردك وإبلاغ المبيعات")); onRefresh();
  }
  return <div className="space-y-3">{!meetings.length && <p className="text-sm text-muted-foreground">{t("لا توجد اجتماعات")}</p>}{meetings.map((m) => {
    const replies = responses.filter((r) => r.meeting_id === m.id);
    return <article key={m.id} className="space-y-2 rounded-md border border-border p-3 text-sm">
      <div className="flex flex-wrap justify-between gap-2"><b>{m.client_name} — {m.project_name}</b><time dir="ltr">{new Date(m.meeting_at).toLocaleString(locale(), { timeZone: "Asia/Riyadh", dateStyle: "medium", timeStyle: "short" })}</time></div>
      {m.topic && <p className="whitespace-pre-wrap font-medium">{m.topic}</p>}
      {m.place && <p>{t("المكان")}: {m.place}</p>}
      {m.notes && <p className="whitespace-pre-wrap text-muted-foreground">{m.notes}</p>}
      <div className="flex flex-wrap gap-3">{REQUIRED_MEETING_PEOPLE.filter((p) => m.attendees.includes(p.email)).map((p) => {
        const status = responseForPerson(replies, p.email); const reply = replies.find((r) => r.attendee_email === p.email);
        return <div key={p.email} className="min-w-0"><span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 ${status === "accepted" ? "bg-accent text-accent-foreground" : status === "declined" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>{t(p.name)}: {t(status === "accepted" ? "وافق على الحضور" : status === "declined" ? "رفض الحضور" : "بانتظار الرد")}</span>{reply?.note && <p className="mt-1 whitespace-pre-wrap break-words">{reply.note}</p>}</div>;
      })}</div>
      {canRespondToMeeting(me?.email, me?.confirmed ?? false, m.attendees) && <div className="space-y-2 border-t border-border pt-2">
        <Textarea aria-label={t("ملاحظة الحضور")} placeholder={t("ملاحظة الحضور")} value={notes[m.id] ?? ""} onChange={(e) => setNotes((prev) => ({ ...prev, [m.id]: e.target.value }))} />
        <div className="flex flex-wrap gap-2"><Button size="sm" disabled={busy !== null} onClick={() => respond(m.id, "accepted")}><Check className="size-4" />{t("موافقة على الحضور")}</Button><Button size="sm" variant="outline" disabled={busy !== null} onClick={() => respond(m.id, "declined")}><X className="size-4" />{t("رفض الحضور")}</Button></div>
      </div>}
    </article>;
  })}</div>;
}

export function SalesMeetingInbox({ attendeeOnly = false }: { attendeeOnly?: boolean }) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [allowed, setAllowed] = useState(!attendeeOnly);
  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const email = auth.user?.email?.toLowerCase();
    if (!auth.user || (attendeeOnly && !REQUIRED_MEETING_PEOPLE.some((p) => p.email === email))) return;
    setAllowed(true);
    let query = supabase.from("sales_meetings").select("*").order("meeting_at", { ascending: false });
    if (attendeeOnly && email) query = query.contains("attendees", [email]);
    const { data, error } = await query;
    if (error) toast.error(t("تعذر تحميل الاجتماعات")); else setMeetings(data ?? []);
  }, [attendeeOnly]);
  useEffect(() => { load(); const timer = setInterval(load, 30000); return () => clearInterval(timer); }, [load]);
  if (!allowed) return null;
  return <section className="space-y-3"><div className="flex items-center justify-between"><h2 className="font-display text-lg font-bold">{t("اجتماعات المبيعات")}</h2><Button size="sm" variant="ghost" onClick={load}>{t("تحديث")}</Button></div><div className="max-h-96 overflow-y-auto"><SalesMeetingAttendance meetings={meetings} onRefresh={load} /></div></section>;
}