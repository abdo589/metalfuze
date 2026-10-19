import { useEffect, useState } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { t, useLanguage } from "@/lib/i18n";
import { ALERT_DAYS, daysLeft } from "@/lib/residency";
import { DOCS, useResidencies } from "@/lib/residency-data";
import { DocBar, StatCard } from "@/components/ResidenciesPanel";

type Doc = { type: string; days: number | null; who: string };

/** Summary cards + one status bar per document type (residency documents and the HR documents sheet). */
export function DocsOverview() {
  useLanguage();
  const { rows } = useResidencies();
  const [extra, setExtra] = useState<{ data: Record<string, unknown> }[]>([]);
  useEffect(() => {
    supabase.from("hr_records").select("data").eq("sheet", "documents").then(({ data }) => setExtra((data ?? []) as never));
  }, []);

  const covered = new Set(DOCS.map((d) => d.label));
  const docs: Doc[] = rows.flatMap((r) => DOCS.map((d) => ({ type: d.label, days: daysLeft(r[d.key]), who: r.name })));
  for (const e of extra) {
    const type = String(e.data["نوع الوثيقة"] ?? "وثيقة");
    if (covered.has(type)) continue;
    const raw = e.data["تاريخ الانتهاء"];
    docs.push({ type, days: raw ? daysLeft(String(raw).slice(0, 10)) : null, who: String(e.data["اسم الموظف"] ?? "") });
  }
  const types = [...DOCS.map((d) => d.label), ...[...new Set(docs.map((d) => d.type))].filter((x) => !covered.has(x))];
  const known = docs.filter((d) => d.days !== null).map((d) => d.days!);
  const people = new Set(docs.map((d) => d.who).filter(Boolean)).size;

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
