import { t, useLanguage, locale } from "@/lib/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, FileDown, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PdfButton } from "@/components/PdfButton";
import { fmtMoney, fmtPct, useProjects } from "@/lib/projects";
import { monthKey, monthLabel, netSalary, usePayroll } from "@/lib/payroll";

export const Route = createFileRoute("/report")({
  head: () => ({
    meta: [
      { title: "التقرير الشهري للرواتب والمشاريع — Metal Fuze" },
      { name: "description", content: "تقرير شهري يربط كل موظف بمشروعه: نسبة الإنجاز، المصروف من العقد، والراتب الصافي." },
      { property: "og:title", content: "التقرير الشهري — Metal Fuze" },
      { property: "og:description", content: "ربط الرواتب بالمشاريع لكل شهر." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Report,
});

function shiftMonth(key: string, d: number) {
  const [y, m] = key.split("-").map(Number);
  return monthKey(new Date(y!, (m ?? 1) - 1 + d, 1));
}

function Report() {
  useLanguage();
  const employees = usePayroll();
  const projects = useProjects();
  const [month, setMonth] = useState(monthKey());

  const rows = useMemo(() => {
    const norm = (s: string) => s.trim().toLowerCase();
    return employees
      .filter((e) => e.active)
      .map((e) => {
        const p = e.project ? projects.find((x) => norm(x.name) === norm(e.project)) : undefined;
        return {
          e,
          p,
          net: netSalary(e),
          paidSalary: e.paidMonths.includes(month),
          spendPct: p && p.contract ? p.paid / p.contract : null,
        };
      });
  }, [employees, projects, month]);

  const byProject = useMemo(() => {
    const m = new Map<string, { name: string; count: number; net: number; progress: number | null }>();
    for (const r of rows) {
      const name = r.e.project || "إدارة عامة (بدون مشروع)";
      const cur = m.get(name) ?? { name, count: 0, net: 0, progress: r.p ? r.p.progress : null };
      cur.count++;
      cur.net += r.net;
      m.set(name, cur);
    }
    return [...m.values()].sort((a, b) => b.net - a.net);
  }, [rows]);

  const total = rows.reduce((a, r) => a + r.net, 0);
  const paid = rows.filter((r) => r.paidSalary).reduce((a, r) => a + r.net, 0);

  async function onExport() {
    try {
      const { exportBrandedExcel } = await import("@/lib/branded-excel");
      await exportBrandedExcel({
        filename: `${locale() === "en-GB" ? "Payroll-Projects-Report" : "تقرير-رواتب-مشاريع"}-${month}.xlsx`,
        reportTitle: `${t("التقرير الشهري: الرواتب والمشاريع")} — ${month}`,
        summary: [
          [t("عدد الموظفين"), rows.length, "int"],
          [t("إجمالي صافي الرواتب"), total, "money"],
          [t("المدفوع"), paid, "money"],
          [t("المتبقي للصرف"), total - paid, "money"],
        ],
        sheets: [
          {
            name: t("الموظفون"),
            title: t("تفاصيل الموظفين والمشاريع"),
            columns: [
              { header: t("الموظف"), width: 22 }, { header: t("المسمى"), width: 18 }, { header: t("المشروع"), width: 28 },
              { header: t("نسبة الإنجاز"), format: "pct" }, { header: t("قيمة العقد"), width: 17, format: "money" },
              { header: t("المصروف من العقد"), width: 17, format: "money" }, { header: t("نسبة الصرف"), format: "pct" },
              { header: t("الراتب الصافي"), format: "money" }, { header: t("حالة الراتب"), width: 12 },
            ],
            rows: rows.map((r) => [r.e.name, r.e.role, r.e.project || "—", r.p ? r.p.progress : "—",
              r.p?.contract ?? "", r.p?.paid ?? "", r.spendPct ?? "—", r.net, r.paidSalary ? t("مدفوع") : t("غير مدفوع")]),
            totals: [7],
          },
          {
            name: t("حسب المشروع"),
            title: t("الرواتب حسب المشروع"),
            columns: [
              { header: t("المشروع"), width: 32 }, { header: t("عدد الموظفين"), format: "int" },
              { header: t("نسبة الإنجاز"), format: "pct" }, { header: t("إجمالي الرواتب"), width: 18, format: "money" },
            ],
            rows: byProject.map((g) => [g.name === "إدارة عامة (بدون مشروع)" ? t(g.name) : g.name, g.count, g.progress ?? "—", g.net]),
            totals: [1, 3],
          },
        ],
      });
      toast.success(t("تم تصدير التقرير"));
    } catch {
      toast.error(t("تعذر التصدير"));
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col items-center gap-4 text-center">
        <div>
          <h1 className="font-display text-3xl font-extrabold sm:text-4xl">{t("التقرير الشهري: الرواتب والمشاريع")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("كل موظف مع مشروعه، الإنجاز، الصرف والراتب الصافي")}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2 print:hidden">
          <ThemeToggle />
          <Button variant="outline" asChild><Link to="/payroll"><ArrowRight /> {t("الرواتب")}</Link></Button>
          <Button variant="outline" asChild><Link to="/">{t("لوحة المشاريع")}</Link></Button>
          <Button variant="outline" onClick={onExport}><FileDown /> {t("تصدير Excel")}</Button>
          <PdfButton />
        </div>
        <div className="flex items-center gap-3">
          <Button size="icon" variant="ghost" className="print:hidden" onClick={() => setMonth(shiftMonth(month, -1))} aria-label={t("الشهر السابق")}><ChevronRight /></Button>
          <span className="min-w-40 font-display text-lg font-bold">{monthLabel(month)}</span>
          <Button size="icon" variant="ghost" className="print:hidden" onClick={() => setMonth(shiftMonth(month, 1))} aria-label={t("الشهر التالي")}><ChevronLeft /></Button>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          [t("إجمالي الرواتب الصافية"), fmtMoney(total)],
          [t("المصروف من الرواتب"), fmtMoney(paid)],
          [t("المتبقي للدفع"), fmtMoney(total - paid)],
        ].map(([l, v]) => (
          <div key={l} className="rounded-2xl border border-border bg-card p-5">
            <div className="text-sm text-muted-foreground">{l}</div>
            <div className="mt-1 font-display text-2xl font-extrabold">{v}</div>
          </div>
        ))}
      </section>

      <section className="overflow-x-auto rounded-2xl border border-border bg-card">
        <h2 className="p-4 font-display text-lg font-bold">{t("تفاصيل الموظفين")}</h2>
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr className="text-right">
              {[t("الموظف"), t("المشروع"), t("الإنجاز"), t("صرف العقد"), t("الراتب الصافي"), t("حالة الراتب")].map((h) => (
                <th key={h} className="px-4 py-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.e.id} className="border-t border-border">
                <td className="px-4 py-3"><div className="font-medium">{r.e.name}</div><div className="text-xs text-muted-foreground">{r.e.role}</div></td>
                <td className="px-4 py-3">{r.e.project || <span className="text-muted-foreground">{t("إدارة عامة")}</span>}</td>
                <td className="px-4 py-3 min-w-32">
                  {r.p ? (
                    <div className="space-y-1">
                      <div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(100, r.p.progress * 100)}%` }} /></div>
                      <div className="text-xs">{fmtPct(r.p.progress)}</div>
                    </div>
                  ) : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-4 py-3">{r.p ? <>{fmtMoney(r.p.paid)} <span className="text-xs text-muted-foreground">({r.spendPct != null ? fmtPct(r.spendPct) : "—"})</span></> : "—"}</td>
                <td className="px-4 py-3 font-bold">{fmtMoney(r.net)}</td>
                <td className="px-4 py-3">{r.paidSalary ? <Badge>{t("مدفوع")}</Badge> : <Badge variant="outline">{t("غير مدفوع")}</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="overflow-x-auto rounded-2xl border border-border bg-card">
        <h2 className="p-4 font-display text-lg font-bold">{t("تكلفة الرواتب حسب المشروع")}</h2>
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr className="text-right">
              {[t("المشروع"), t("عدد الموظفين"), t("الإنجاز"), t("إجمالي الرواتب")].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {byProject.map((g) => (
              <tr key={g.name} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{t(g.name)}</td>
                <td className="px-4 py-3">{g.count}</td>
                <td className="px-4 py-3">{g.progress != null ? fmtPct(g.progress) : "—"}</td>
                <td className="px-4 py-3 font-bold">{fmtMoney(g.net)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
