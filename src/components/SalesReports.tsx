import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PdfButton } from "@/components/PdfButton";
import { t, locale } from "@/lib/i18n";
import { commissionDue } from "@/lib/sales";

type D = Tables<"sales_deals">;
type LogE = { at: string; by: string; action: string; note: string; to?: string };
type Ev = { at: string; kind: string; deal: string; detail: string };
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Work report built automatically from the deals the viewer can see. */
export function SalesReports({ open, onClose, rows }: { open: boolean; onClose: () => void; rows: D[] }) {
  const today = new Date();
  const [from, setFrom] = useState(iso(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [to, setTo] = useState(iso(today));
  const [meetings, setMeetings] = useState<Tables<"sales_meetings">[]>([]);
  useEffect(() => { if (open) supabase.from("sales_meetings").select("*").then(({ data }) => setMeetings(data ?? [])); }, [open]);
  const quick = (days: number) => { const s = new Date(); s.setDate(s.getDate() - days); setFrom(iso(s)); setTo(iso(new Date())); };

  const r = useMemo(() => {
    const a = new Date(from + "T00:00:00").getTime(), b = new Date(to + "T23:59:59").getTime();
    const inR = (s: string) => { const x = new Date(s).getTime(); return x >= a && x <= b; };
    const ids = new Map(rows.map((d) => [d.id, d]));
    const name = (d?: D) => d ? `${d.client} — ${d.project}` : "";
    const ev: Ev[] = [];
    for (const d of rows) {
      if (inR(d.created_at)) ev.push({ at: d.created_at, kind: t("طلب تسعير جديد"), deal: name(d), detail: t(d.stage) });
      for (const l of ((d.workflow_log ?? []) as LogE[])) if (l.at && inR(l.at))
        ev.push({ at: l.at, kind: l.action === "reject" ? t("رفض") : t("اعتماد مرحلة"), deal: name(d), detail: [l.by, l.note].filter(Boolean).join(" — ") });
    }
    for (const m of meetings) if (inR(m.meeting_at)) ev.push({ at: m.meeting_at, kind: t("اجتماع مع عميل"), deal: name(ids.get(m.deal_id)), detail: [m.place, m.notes].filter(Boolean).join(" — ") });
    ev.sort((x, y) => x.at.localeCompare(y.at));
    const created = rows.filter((d) => inR(d.created_at));
    return {
      ev, created: created.length,
      won: created.filter((d) => d.stage === "فاز").length,
      quotes: created.reduce((s, d) => s + Number(d.quote_value), 0),
      contracts: created.reduce((s, d) => s + Number(d.contract_value), 0),
      commission: created.reduce((s, d) => s + commissionDue(d), 0),
      meetings: ev.filter((e) => e.kind === t("اجتماع مع عميل")).length,
    };
  }, [rows, meetings, from, to]);
  const fmt = (n: number) => Math.round(n).toLocaleString(locale());

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader><DialogTitle>{t("التقارير")}</DialogTitle></DialogHeader>
        <div className="flex flex-wrap items-end gap-2">
          <Button size="sm" variant="outline" onClick={() => quick(0)}>{t("اليوم")}</Button>
          <Button size="sm" variant="outline" onClick={() => quick(6)}>{t("آخر أسبوع")}</Button>
          <Button size="sm" variant="outline" onClick={() => quick(29)}>{t("آخر شهر")}</Button>
          <label className="text-xs">{t("من")}<Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="text-xs">{t("إلى")}<Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          <PdfButton />
        </div>
        <div data-report-document className="space-y-4 bg-background p-4">
          <div><h2 className="font-display text-xl font-bold">{t("تقرير أعمال المبيعات")} — Metal Fuze</h2>
            <p className="text-sm text-muted-foreground" dir="ltr">{from} → {to}</p></div>
          <div className="grid grid-cols-3 gap-2 text-sm">
            {[["طلبات جديدة", r.created], ["فاز", r.won], ["الاجتماعات", r.meetings], ["قيمة العروض", r.quotes], ["قيمة العقود", r.contracts], ["العمولة المستحقة", r.commission]].map(([l, v]) => (
              <div key={l as string} className="rounded-md border border-border p-2"><div className="text-muted-foreground">{t(l as string)}</div><div className="font-bold" dir="ltr">{fmt(v as number)}</div></div>))}
          </div>
          <table className="w-full border-collapse text-sm">
            <thead><tr className="border-b border-border text-start">{["التاريخ", "النشاط", "المشروع", "التفاصيل"].map((h) => <th key={h} className="p-2 text-start">{t(h)}</th>)}</tr></thead>
            <tbody>{r.ev.length === 0 ? <tr><td colSpan={4} className="p-3 text-center text-muted-foreground">{t("لا يوجد نشاط في هذه الفترة")}</td></tr> : r.ev.map((e, i) => (
              <tr key={i} className="border-b border-border"><td className="p-2 whitespace-nowrap" dir="ltr">{new Date(e.at).toLocaleString(locale())}</td><td className="p-2">{e.kind}</td><td className="p-2">{e.deal}</td><td className="p-2">{e.detail}</td></tr>))}</tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
