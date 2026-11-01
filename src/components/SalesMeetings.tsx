import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { t, locale } from "@/lib/i18n";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { REQUIRED_MEETING_PEOPLE, standaloneMeetingInput } from "@/lib/sales-meetings";
import { SalesMeetingAttendance } from "@/components/SalesMeetingAttendance";

// Optional companions are separate from mandatory approval recipients.
export const MEETING_PEOPLE = [
  ...REQUIRED_MEETING_PEOPLE,
  { email: "hisham@metalfuze.local", name: "هشام" },
  { email: "eilaf@metalfuze.local", name: "Eilaf" },
];

type M = Tables<"sales_meetings">;

export function SalesMeetings({ deal, onClose, standalone = false }: { deal: { id: string; client: string; project: string } | null; onClose: () => void; standalone?: boolean }) {
  const [list, setList] = useState<M[]>([]);
  const [at, setAt] = useState(""); const [place, setPlace] = useState(""); const [notes, setNotes] = useState("");
  const [topic, setTopic] = useState("");
  const [who, setWho] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const load = async (id: string) => {
    const { data, error } = await supabase.from("sales_meetings").select("*").eq("deal_id", id).order("meeting_at");
    if (error) { toast.error(t("تعذر تحميل الاجتماعات")); return; }
    setList((data ?? []) as M[]);
  };
  useEffect(() => { if (deal || standalone) { if (deal) load(deal.id); else setList([]); setWho([]); setAt(""); setPlace(""); setNotes(""); setTopic(""); } }, [deal, standalone]);

  async function add() {
    if (!deal && !standalone) return;
    if (!at) { toast.error(t("حدد موعد الاجتماع")); return; }
    if (!topic.trim()) { toast.error(t("اكتب بيانات الاجتماع")); return; }
    setBusy(true);
    const when = new Date(at);
    if (!Number.isFinite(when.getTime())) { setBusy(false); toast.error(t("حدد موعد الاجتماع")); return; }
    const payload: TablesInsert<"sales_meetings"> = { ...standaloneMeetingInput(topic, when.toISOString(), place, notes, who), deal_id: deal?.id ?? null };
    const { error } = await supabase.from("sales_meetings").insert(payload);
    if (error) { setBusy(false); toast.error(`${t("تعذر الحفظ، حاول مرة أخرى")} (${error.message})`); return; }
    // Alerts to attendees are sent by the database right after the meeting is saved.
    setBusy(false);
    toast.success(t("تم حفظ الاجتماع وإرسال التنبيه"));
    setAt(""); setPlace(""); setNotes(""); setTopic(""); if (standalone) onClose(); else if (deal) load(deal.id);
  }
  async function del(id: string) {
    if (!confirm(t("حذف؟")) || !deal) return;
    const { error } = await supabase.from("sales_meetings").delete().eq("id", id);
    if (error) { toast.error(t("تعذر الحفظ، حاول مرة أخرى")); return; }
    load(deal.id);
  }

  return (
    <Dialog open={!!deal || standalone} onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir={locale() === "en-GB" ? "ltr" : "rtl"} className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle>{standalone ? t("إنشاء اجتماع") : `${t("الاجتماعات")} — ${deal?.client}`}</DialogTitle></DialogHeader>
        {!standalone && <div className="space-y-2">
          {list.length === 0 ? <p className="text-sm text-muted-foreground">{t("لا توجد اجتماعات")}</p> : list.map((m) => (
            <div key={m.id} className="rounded-md border border-border p-2 text-sm">
              <div className="flex justify-between gap-2"><b dir="ltr">{new Date(m.meeting_at).toLocaleString(locale())}</b>
                <Button size="sm" variant="ghost" className="text-xs text-destructive" onClick={() => del(m.id)}>{t("حذف")}</Button></div>
              {m.place && <div>{t("المكان")}: {m.place}</div>}
              <div className="text-muted-foreground">{m.attendees.map((e) => MEETING_PEOPLE.find((p) => p.email === e)?.name ?? e).join("، ")}</div>
              {m.notes && <div className="whitespace-pre-wrap">{m.notes}</div>}
            </div>))}
        </div>}
        {!standalone && <SalesMeetingAttendance meetings={list} onRefresh={() => deal && load(deal.id)} />}
        <div className="space-y-3 border-t border-border pt-3">
          <div><Label>{t(standalone ? "محتوى الاجتماع" : "بيانات الاجتماع")}</Label><Textarea aria-label={t(standalone ? "محتوى الاجتماع" : "بيانات الاجتماع")} value={topic} onChange={(e) => setTopic(e.target.value)} /></div>
          <div><Label>{t("الموعد")}</Label><Input aria-label={t("الموعد")} type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} /></div>
          <div><Label>{t("المكان")}</Label><Input value={place} onChange={(e) => setPlace(e.target.value)} /></div>
          <div><Label>{t("المسؤول المرافق")} — {t("اختياري")}</Label>
            <div className="mt-1 flex flex-wrap gap-4">{MEETING_PEOPLE.map((p) => (
              <label key={p.email} className="flex items-center gap-2 text-sm">
                <Checkbox checked={who.includes(p.email)} onCheckedChange={(c) => setWho((w) => c ? [...w, p.email] : w.filter((x) => x !== p.email))} />{t(p.name)}
              </label>))}</div></div>
          <div><Label>{t("ملاحظات")}</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <Button onClick={add} disabled={busy} className="w-full">{t("حفظ الاجتماع وإرسال تنبيه")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
