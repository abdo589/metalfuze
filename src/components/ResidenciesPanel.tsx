import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, CalendarClock, CheckCircle2, FileText, Pencil, Plus, Save, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { t, useLanguage } from "@/lib/i18n";
import { useCanEdit } from "@/lib/permissions";
import { ALERT_DAYS, daysLeft, docStatus } from "@/lib/residency";
import { DOCS, useResidencies, type Residency } from "@/lib/residency-data";
import { PdfButton } from "@/components/PdfButton";


const tone = {
  expired: "border-destructive/30 bg-destructive/15 text-destructive",
  soon: "border-warning/30 bg-warning/15 text-warning",
  valid: "border-success/30 bg-success/15 text-success",
  none: "",
};

function Cell({ v, ltr = false }: { v: string | number | null | undefined; ltr?: boolean }) {
  return <td className="whitespace-nowrap p-2 text-center" dir={ltr ? "ltr" : undefined}>{v === null || v === undefined || v === "" ? "—" : String(v)}</td>;
}

function DateCell({ r, k }: { r: Residency; k: (typeof DOCS)[number]["key"] }) {
  const d = daysLeft(r[k]);
  const s = docStatus(d);
  return (
    <td className="whitespace-nowrap p-2 text-center">
      <div className="text-xs" dir="ltr">{r[k] ?? "—"}</div>
      {d !== null && <Badge variant="outline" className={`mt-1 ${tone[s]}`}>
        {s === "expired" ? `${t("منتهية منذ")} ${-d} ${t("يوم")}` : `${d} ${t("يوم")}`}
      </Badge>}
    </td>
  );
}

const FIELDS: { k: keyof Residency; label: string; type: "text" | "number" | "date" }[] = [
  { k: "name", label: "اسم الموظف", type: "text" },
  { k: "job", label: "الوظيفة", type: "text" },
  { k: "nationality", label: "الجنسية", type: "text" },
  { k: "iqama_no", label: "رقم الإقامة", type: "text" },
  ...DOCS.map((d) => ({ k: d.key as keyof Residency, label: d.label, type: "date" as const })),
  { k: "iqama_fee", label: "رسوم الإقامة", type: "number" },
  { k: "permit_fee", label: "رسوم رخصة العمل", type: "number" },
];

function EditDialog({ r, onClose, reload }: { r: Residency | null; onClose: () => void; reload: () => void }) {
  const [f, setF] = useState<Record<string, string>>({});
  useEffect(() => {
    if (r) setF(Object.fromEntries(FIELDS.map(({ k }) => [k, r[k] == null ? "" : String(r[k])])));
  }, [r]);
  async function save() {
    if (!r) return;
    const patch: Record<string, string | number | null> = {};
    for (const { k, type } of FIELDS) {
      const v = (f[k] ?? "").trim();
      patch[k] = v === "" ? (k === "name" ? r.name : null) : type === "number" ? Number(v) : v;
    }
    const { error } = await supabase.from("residencies").update(patch as Partial<Residency>).eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    toast.success(t("تم التحديث")); onClose(); reload();
  }
  return (
    <Dialog open={!!r} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{t("تعديل")} — {r?.name}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {FIELDS.map(({ k, label, type }) => (
            <label key={k} className="space-y-1 text-sm">
              <span className="text-muted-foreground">{t(label)}</span>
              <Input type={type} dir={type === "text" && k !== "iqama_no" ? undefined : "ltr"} value={f[k] ?? ""}
                onChange={(e) => setF({ ...f, [k]: e.target.value })} />
            </label>
          ))}
        </div>
        <div className="flex gap-2">
          <Button onClick={save}><Save /> {t("حفظ")}</Button>
          <Button variant="outline" onClick={onClose}>{t("إلغاء")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatCard({ label, value, icon, cls }: { label: string; value: number; icon: React.ReactNode; cls: string }) {
  return (
    <div className={`flex items-center gap-3 rounded-xl border p-4 ${cls}`}>
      <div className="rounded-lg bg-background/60 p-2">{icon}</div>
      <div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

function DocBar({ label, expired, soon, valid, unset, total }: {
  label: string; expired: number; soon: number; valid: number; unset: number; total: number;
}) {
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  return (
    <div className="space-y-2 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 font-medium"><FileText className="size-4 text-muted-foreground" /> {label}</div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="bg-destructive" style={{ width: `${pct(expired)}%` }} />
        <div className="bg-warning" style={{ width: `${pct(soon)}%` }} />
        <div className="bg-success" style={{ width: `${pct(valid)}%` }} />
      </div>
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="text-destructive">{t("منتهية")} {expired}</span>
        <span className="text-warning">{t("قرب الانتهاء")} {soon}</span>
        <span className="text-success">{t("سارية")} {valid}</span>
        {unset > 0 && <span>{t("غير مسجل")} {unset}</span>}
      </div>
    </div>
  );
}

export function Residencies() {
  useLanguage();
  const canEdit = useCanEdit();
  const { rows, reload } = useResidencies();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<Residency | null>(null);

  const alerts = rows.flatMap((r) => DOCS.map((doc) => ({ r, doc, d: daysLeft(r[doc.key]) })))
    .filter((a) => a.d !== null && a.d <= ALERT_DAYS).sort((a, b) => a.d! - b.d!);

  const all = rows.flatMap((r) => DOCS.map((doc) => daysLeft(r[doc.key]))).filter((x): x is number => x !== null);
  const nExpired = all.filter((d) => d < 0).length;
  const nSoon = all.filter((d) => d >= 0 && d <= ALERT_DAYS).length;
  const nValid = all.filter((d) => d > ALERT_DAYS).length;

  const docStats = DOCS.map((d) => {
    const ds = rows.map((r) => daysLeft(r[d.key])).filter((x): x is number => x !== null);
    return {
      d,
      expired: ds.filter((x) => x < 0).length,
      soon: ds.filter((x) => x >= 0 && x <= ALERT_DAYS).length,
      valid: ds.filter((x) => x > ALERT_DAYS).length,
      unset: rows.length - ds.length,
    };
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <header className="space-y-1 text-center">
        <h1 className="font-display text-2xl font-bold md:text-3xl">{t("بيانات الموظفين")}</h1>
        <p className="text-sm text-muted-foreground">{t("تنبيه قبل الانتهاء بـ")} {ALERT_DAYS} {t("يوم")}</p>
        <div className="print:hidden"><PdfButton /></div>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label={t("إجمالي الموظفين")} value={rows.length} icon={<Users className="size-5 text-primary" />} cls="border-border bg-card" />
        <StatCard label={t("قرب الانتهاء")} value={nSoon} icon={<CalendarClock className="size-5 text-warning" />} cls="border-warning/40 bg-warning/10" />
        <StatCard label={t("منتهية")} value={nExpired} icon={<AlertTriangle className="size-5 text-destructive" />} cls="border-destructive/40 bg-destructive/10" />
        <StatCard label={t("سارية")} value={nValid} icon={<CheckCircle2 className="size-5 text-success" />} cls="border-success/40 bg-success/10" />
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        {docStats.map((s) => (
          <DocBar key={s.d.key} label={t(s.d.label)} expired={s.expired} soon={s.soon} valid={s.valid} unset={s.unset} total={rows.length} />
        ))}
      </section>

      {alerts.length > 0 && (
        <section className="space-y-3 rounded-xl border border-warning/40 bg-warning/10 p-4">
          <h2 className="flex items-center gap-2 font-bold"><AlertTriangle className="size-5 text-warning" /> {t("الأقرب للانتهاء")} ({alerts.length})</h2>
          <div className="grid gap-2 md:grid-cols-2">
            {alerts.map((a) => {
              const s = docStatus(a.d);
              return (
                <div key={a.r.id + a.doc.key} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background/60 p-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{a.r.name}</div>
                    <div className="text-xs text-muted-foreground">{t(a.doc.label)}</div>
                  </div>
                  <Badge variant="outline" className={`shrink-0 ${tone[s]}`}>
                    {a.d! < 0 ? `${t("منتهية منذ")} ${-a.d!} ${t("يوم")}` : `${t("تنتهي خلال")} ${a.d} ${t("يوم")}`}
                  </Badge>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <h2 className="text-lg font-semibold">{t("جدول التفاصيل")}</h2>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-2 text-start">{t("اسم الموظف")}</th>
              <th className="p-2">{t("الجنسية")}</th>
              <th className="p-2">{t("رقم الإقامة")}</th>
              {DOCS.map((d) => <th key={d.key} className="p-2">{t(d.label)}</th>)}
              <th className="p-2">{t("رسوم الإقامة")}</th>
              <th className="p-2">{t("رسوم رخصة العمل")}</th>
              {canEdit && <th className="print:hidden" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="whitespace-nowrap p-2">
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-muted-foreground">{r.job ?? ""}</div>
                </td>
                <Cell v={r.nationality} />
                <Cell v={r.iqama_no} ltr />
                {DOCS.map((d) => <DateCell key={d.key} r={r} k={d.key} />)}
                <Cell v={r.iqama_fee} />
                <Cell v={r.permit_fee} />
                {canEdit && <td className="whitespace-nowrap p-2 print:hidden">
                  <Button size="sm" variant="outline" onClick={() => setEditing(r)}><Pencil /> {t("تعديل")}</Button>
                  <Button size="icon" variant="ghost" aria-label={t("حذف")} onClick={async () => {
                    if (!confirm(t("حذف") + " " + r.name + "؟")) return;
                    await supabase.from("residencies").delete().eq("id", r.id); reload();
                  }}><Trash2 /></Button>
                </td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <EditDialog r={editing} onClose={() => setEditing(null)} reload={reload} />

      {canEdit && (
        <form className="flex gap-2 print:hidden" onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          const { error } = await supabase.from("residencies").insert({ name: name.trim() });
          if (error) toast.error(error.message); else { setName(""); reload(); }
        }}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("اسم الموظف")} />
          <Button type="submit"><Plus /> {t("إضافة موظف")}</Button>
        </form>
      )}
    </div>
  );
}
