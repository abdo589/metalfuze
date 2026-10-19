import { useEffect, useState } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { t, useLanguage } from "@/lib/i18n";
import { ALERT_DAYS, daysLeft } from "@/lib/residency";
import { DocBar, StatCard } from "@/components/ResidenciesPanel";

type Row = { data: Record<string, unknown> };

/** Summary cards + one status bar per document type, built only from the «الوثائق والانتهاءات» sheet. */
export function DocsOverview({ rows: given }: { rows?: Row[] }) {
  useLanguage();
  const [fetched, setFetched] = useState<Row[]>([]);
  const [extra, setExtra] = useState<{ type: string; days: number | null; who: string }[]>([]);
  useEffect(() => {
    if (given) return;
    supabase.from("hr_records").select("data").eq("sheet", "documents").then(({ data }) => setFetched((data ?? []) as never));
  }, [given]);
  useEffect(() => {
    // Work permit, health insurance and contract dates live on the employee residency records.
    supabase.from("residencies").select("name,permit_expiry,insurance_expiry,contract_expiry").then(({ data }) => {
      const kinds = [["permit_expiry", "رخصة العمل"], ["insurance_expiry", "التأمين الصحي"], ["contract_expiry", "العقد"]] as const;
      setExtra((data ?? []).flatMap((r) => kinds.map(([k, type]) => ({
        type, days: r[k] ? daysLeft(String(r[k]).slice(0, 10)) : null, who: r.name,
      }))));
    });
  }, []);
  const rows = given ?? fetched;

  const docs = [...rows.map((r) => {
    const raw = r.data["تاريخ الانتهاء"];
    return {
      type: String(r.data["نوع الوثيقة"] ?? "").trim() || "وثيقة",
      days: raw ? daysLeft(String(raw).slice(0, 10)) : null,
      who: String(r.data["رقم الموظف"] ?? r.data["اسم الموظف"] ?? ""),
    };
  }), ...extra];
  const people = new Set(rows.map((r) => String(r.data["رقم الموظف"] ?? r.data["اسم الموظف"] ?? "")).filter(Boolean)).size;
  const types = [...new Set(docs.map((d) => d.type))];
  const known = docs.filter((d) => d.days !== null).map((d) => d.days!);

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label={t("إجمالي الموظفين")} value={people} icon={<Users className="size-5 text-primary" />} cls="border-border bg-card" />
        <StatCard label={t("قرب الانتهاء")} value={known.filter((d) => d >= 0 && d <= ALERT_DAYS).length} icon={<CalendarClock className="size-5 text-warning" />} cls="border-warning/40 bg-warning/10" />
        <StatCard label={t("منتهية")} value={known.filter((d) => d < 0).length} icon={<AlertTriangle className="size-5 text-destructive" />} cls="border-destructive/40 bg-destructive/10" />
        <StatCard label={t("سارية")} value={known.filter((d) => d > ALERT_DAYS).length} icon={<CheckCircle2 className="size-5 text-success" />} cls="border-success/40 bg-success/10" />
      </section>
      <section className="grid gap-3 sm:grid-cols-2">
        {types.map((ty) => {
          const ds = docs.filter((d) => d.type === ty);
          const k = ds.filter((d) => d.days !== null).map((d) => d.days!);
          return <DocBar key={ty} label={t(ty)} total={ds.length} unset={ds.length - k.length}
            expired={k.filter((d) => d < 0).length} soon={k.filter((d) => d >= 0 && d <= ALERT_DAYS).length} valid={k.filter((d) => d > ALERT_DAYS).length} />;
        })}
      </section>
    </div>
  );
}
