import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, FileText, Plus, Trash2, Users } from "lucide-react";
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

export const Route = createFileRoute("/residencies")({
  head: () => ({
    meta: [
      { title: "بيانات الموظفين — Metal Fuze" },
      { name: "description", content: "لوحة متابعة انتهاء الإقامات ورخص العمل والتأمين والعقود مع تنبيهات قبل الانتهاء." },
      { property: "og:title", content: "بيانات الموظفين — Metal Fuze" },
      { property: "og:description", content: "تنبيهات انتهاء الإقامات والرخص لموظفي Metal Fuze." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Residencies,
});

const tone = {
  expired: "border-destructive/30 bg-destructive/15 text-destructive",
  soon: "border-warning/30 bg-warning/15 text-warning",
  valid: "border-success/30 bg-success/15 text-success",
  none: "",
};

const inputCls = "w-full rounded border border-input bg-background px-1.5 py-1 text-xs";

type FieldKey = "nationality" | "iqama_no" | "iqama_fee" | "permit_fee";

function Field({ r, k, canEdit, reload, type = "text", ltr = false }: {
  r: Residency; k: FieldKey; canEdit: boolean; reload: () => void; type?: "text" | "number"; ltr?: boolean;
}) {
  const cur = r[k];
  return (
    <td className="p-2" dir={ltr ? "ltr" : undefined}>
      {canEdit ? (
        <input
          type={type}
          defaultValue={cur ?? ""}
          className={inputCls}
          onBlur={async (e) => {
            const raw = e.target.value.trim();
            let v: string | number | null;
            if (type === "number") {
              if (raw === "") v = null; else { v = Number(raw); if (Number.isNaN(v)) return; }
            } else v = raw || null;
            if (v === cur) return;
            const { error } = await supabase.from("residencies").update({ [k]: v } as Partial<Residency>).eq("id", r.id);
            if (error) toast.error(error.message); else { toast.success(t("تم التحديث")); reload(); }
          }}
        />
      ) : <div className="text-xs" dir={ltr ? "ltr" : undefined}>{cur ?? "—"}</div>}
    </td>
  );
}

function NameCell({ r, canEdit, reload }: { r: Residency; canEdit: boolean; reload: () => void }) {
  const save = async (k: "name" | "job", v: string) => {
    v = v.trim();
    if (v === (r[k] ?? "")) return;
    const { error } = await supabase.from("residencies").update({ [k]: v || null } as Partial<Residency>).eq("id", r.id);
    if (error) toast.error(error.message); else { toast.success(t("تم التحديث")); reload(); }
  };
  if (!canEdit) return (
    <>
      <div className="font-medium">{r.name}</div>
      <div className="text-xs text-muted-foreground">{r.job ?? ""}</div>
    </>
  );
  return (
    <>
      <input type="text" defaultValue={r.name} className={inputCls + " font-medium"} onBlur={(e) => save("name", e.target.value)} />
      <input type="text" defaultValue={r.job ?? ""} placeholder={t("الوظيفة")} className={inputCls} onBlur={(e) => save("job", e.target.value)} />
    </>
  );
}

function DateCell({ r, k, canEdit, reload }: { r: Residency; k: (typeof DOCS)[number]["key"]; canEdit: boolean; reload: () => void }) {
  const d = daysLeft(r[k]);
  const s = docStatus(d);
  return (
    <td className="p-2 text-center">
      {canEdit ? (
        <input type="date" defaultValue={r[k] ?? ""} className="rounded border border-input bg-background px-1 text-xs"
          onBlur={async (e) => {
            const v = e.target.value || null;
            if (v === r[k]) return;
            const { error } = await supabase.from("residencies").update({ [k]: v } as Partial<Residency>).eq("id", r.id);
            if (error) toast.error(error.message); else reload();
          }} />
      ) : <div className="text-xs">{r[k] ?? "—"}</div>}
      {d !== null && <Badge variant="outline" className={`mt-1 ${tone[s]}`}>
        {s === "expired" ? `${t("منتهية منذ")} ${-d} ${t("يوم")}` : `${d} ${t("يوم")}`}
      </Badge>}
    </td>
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

function Residencies() {
  useLanguage();
  const canEdit = useCanEdit();
  const { rows, reload } = useResidencies();
  const [name, setName] = useState("");

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
                <td className="p-2 min-w-44 space-y-1">
                  <NameCell r={r} canEdit={canEdit} reload={reload} />
                </td>
                <Field r={r} k="nationality" canEdit={canEdit} reload={reload} />
                <Field r={r} k="iqama_no" canEdit={canEdit} reload={reload} ltr />
                {DOCS.map((d) => <DateCell key={d.key} r={r} k={d.key} canEdit={canEdit} reload={reload} />)}
                <Field r={r} k="iqama_fee" canEdit={canEdit} reload={reload} type="number" />
                <Field r={r} k="permit_fee" canEdit={canEdit} reload={reload} type="number" />
                {canEdit && <td className="p-2 print:hidden">
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
