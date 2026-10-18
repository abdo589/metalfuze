import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
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
      { title: "تتبع الإقامات — Metal Fuze" },
      { name: "description", content: "متابعة انتهاء الإقامات ورخص العمل والتأمين والعقود مع تنبيهات قبل الانتهاء." },
      { property: "og:title", content: "تتبع الإقامات — Metal Fuze" },
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

function Cell({ r, k, canEdit, reload }: { r: Residency; k: (typeof DOCS)[number]["key"]; canEdit: boolean; reload: () => void }) {
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

function Residencies() {
  useLanguage();
  const canEdit = useCanEdit();
  const { rows, reload } = useResidencies();
  const [name, setName] = useState("");
  const alerts = rows.flatMap((r) => DOCS.map((doc) => ({ r, doc, d: daysLeft(r[doc.key]) })))
    .filter((a) => a.d !== null && a.d <= ALERT_DAYS).sort((a, b) => a.d! - b.d!);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <header className="space-y-1 text-center">
        <h1 className="font-display text-2xl font-bold md:text-3xl">{t("تتبع الإقامات")}</h1>
        <p className="text-sm text-muted-foreground">{t("تنبيه قبل الانتهاء بـ")} {ALERT_DAYS} {t("يوم")}</p>
        <div className="print:hidden"><PdfButton /></div>
      </header>

      {alerts.length > 0 && (
        <section className="space-y-2 rounded-xl border border-warning/40 bg-warning/10 p-4">
          <h2 className="flex items-center gap-2 font-bold"><AlertTriangle className="size-5 text-warning" /> {t("تنبيهات")} ({alerts.length})</h2>
          {alerts.map((a) => (
            <div key={a.r.id + a.doc.key} className="text-sm">
              <b>{a.r.name}</b> — {t(a.doc.label)}: {a.d! < 0 ? `${t("منتهية منذ")} ${-a.d!} ${t("يوم")}` : `${t("تنتهي خلال")} ${a.d} ${t("يوم")}`} ({a.r[a.doc.key]})
            </div>
          ))}
        </section>
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-2 text-start">{t("اسم الموظف")}</th>
              <th className="p-2">{t("الجنسية")}</th>
              <th className="p-2">{t("رقم الإقامة")}</th>
              {DOCS.map((d) => <th key={d.key} className="p-2">{t(d.label)}</th>)}
              {canEdit && <th className="print:hidden" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="p-2"><div className="font-medium">{r.name}</div><div className="text-xs text-muted-foreground">{r.job}</div></td>
                <td className="p-2 text-center">{r.nationality}</td>
                <td className="p-2 text-center" dir="ltr">{r.iqama_no}</td>
                {DOCS.map((d) => <Cell key={d.key} r={r} k={d.key} canEdit={canEdit} reload={reload} />)}
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
