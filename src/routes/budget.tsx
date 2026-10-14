import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { fmtMoney, fmtPct, useProjects } from "@/lib/projects";
import { monthKey, monthLabel, netSalary, usePayroll } from "@/lib/payroll";

export const Route = createFileRoute("/budget")({
  head: () => ({
    meta: [
      { title: "لوحة الميزانية — Metal Fuze" },
      { name: "description", content: "إجمالي العقود، الصرف الشهري والمتبقي مرتبطة تلقائياً بالمشاريع والرواتب." },
      { property: "og:title", content: "لوحة الميزانية — Metal Fuze" },
      { property: "og:description", content: "ميزانية المشاريع والرواتب في مكان واحد." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Budget,
});

function shiftMonth(key: string, d: number) {
  const [y, m] = key.split("-").map(Number);
  return monthKey(new Date(y!, (m ?? 1) - 1 + d, 1));
}

function Budget() {
  const projects = useProjects();
  const employees = usePayroll();
  const [month, setMonth] = useState(monthKey());

  const data = useMemo(() => {
    const active = employees.filter((e) => e.active);
    const norm = (s: string) => s.trim().toLowerCase();
    const rows = projects.map((p) => {
      const staff = active.filter((e) => e.project && norm(e.project) === norm(p.name));
      const salaries = staff.reduce((a, e) => a + netSalary(e), 0);
      return { p, staff: staff.length, salaries, remaining: (p.contract || 0) - (p.paid || 0) };
    });
    const contracts = projects.reduce((a, p) => a + (p.contract || 0), 0);
    const paid = projects.reduce((a, p) => a + (p.paid || 0), 0);
    const payroll = active.reduce((a, e) => a + netSalary(e), 0);
    const payrollPaid = active.filter((e) => e.paidMonths.includes(month)).reduce((a, e) => a + netSalary(e), 0);
    const general = payroll - rows.reduce((a, r) => a + r.salaries, 0);
    return { rows: rows.sort((a, b) => b.p.contract - a.p.contract), contracts, paid, payroll, payrollPaid, general };
  }, [projects, employees, month]);

  const kpis: [string, string, string | undefined][] = [
    ["إجمالي العقود", fmtMoney(data.contracts), undefined],
    ["المصروف من العقود", fmtMoney(data.paid), data.contracts ? fmtPct(data.paid / data.contracts) : undefined],
    ["المتبقي من العقود", fmtMoney(data.contracts - data.paid), undefined],
    ["صرف الرواتب الشهري", fmtMoney(data.payroll), `مدفوع ${fmtMoney(data.payrollPaid)}`],
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col items-center gap-4 text-center">
        <div>
          <h1 className="font-display text-3xl font-extrabold sm:text-4xl">لوحة الميزانية</h1>
          <p className="mt-1 text-sm text-muted-foreground">تتحدث تلقائياً من بيانات المشاريع والرواتب</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2 print:hidden">
          <ThemeToggle />
          <Button variant="outline" asChild><Link to="/"><ArrowRight /> لوحة المشاريع</Link></Button>
          <Button variant="outline" asChild><Link to="/payroll">الرواتب</Link></Button>
          <Button variant="outline" asChild><Link to="/report">التقرير الشهري</Link></Button>
          <Button variant="outline" onClick={() => window.print()}><Printer /> طباعة / PDF</Button>
        </div>
        <div className="flex items-center gap-3">
          <Button size="icon" variant="ghost" className="print:hidden" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="الشهر السابق"><ChevronRight /></Button>
          <span className="min-w-40 font-display text-lg font-bold">{monthLabel(month)}</span>
          <Button size="icon" variant="ghost" className="print:hidden" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="الشهر التالي"><ChevronLeft /></Button>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(([l, v, sub]) => (
          <div key={l} className="rounded-2xl border border-border bg-card p-5">
            <div className="text-sm text-muted-foreground">{l}</div>
            <div className="mt-1 font-display text-2xl font-extrabold">{v}</div>
            {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
          </div>
        ))}
      </section>

      <section className="overflow-x-auto rounded-2xl border border-border bg-card">
        <h2 className="p-4 font-display text-lg font-bold">الميزانية حسب المشروع</h2>
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr className="text-right">
              {["المشروع", "قيمة العقد", "المصروف", "المتبقي", "نسبة الصرف", "الإنجاز", "موظفون", "رواتب الشهر"].map((h) => (
                <th key={h} className="px-4 py-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map(({ p, staff, salaries, remaining }) => {
              const spend = p.contract ? p.paid / p.contract : 0;
              const over = spend > p.progress + 0.1;
              return (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3">{fmtMoney(p.contract)}</td>
                  <td className="px-4 py-3">{fmtMoney(p.paid)}</td>
                  <td className="px-4 py-3 font-bold">{fmtMoney(remaining)}</td>
                  <td className="px-4 py-3 min-w-32">
                    <div className="h-2 rounded-full bg-muted"><div className={`h-2 rounded-full ${over ? "bg-destructive" : "bg-primary"}`} style={{ width: `${Math.min(100, spend * 100)}%` }} /></div>
                    <div className={`mt-1 text-xs ${over ? "text-destructive" : ""}`}>{fmtPct(spend)}{over ? " — الصرف أعلى من الإنجاز" : ""}</div>
                  </td>
                  <td className="px-4 py-3">{fmtPct(p.progress)}</td>
                  <td className="px-4 py-3">{staff}</td>
                  <td className="px-4 py-3">{salaries ? fmtMoney(salaries) : "—"}</td>
                </tr>
              );
            })}
            <tr className="border-t border-border bg-muted/30">
              <td className="px-4 py-3 font-medium" colSpan={7}>رواتب إدارة عامة (غير مرتبطة بمشروع)</td>
              <td className="px-4 py-3 font-bold">{fmtMoney(data.general)}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
