import { t, useLanguage, locale } from "@/lib/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, Banknote, CircleAlert, FileDown, FileSpreadsheet, FolderKanban, BrainCircuit, Pencil, Plus, Printer, Search, Trash2, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ProjectDialog } from "@/components/ProjectDialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PdfButton } from "@/components/PdfButton";
import {
  daysLeft, deadlineAlert, fmtMoney, fmtPct, importExcel, projectStore, useProjects, type Project,
} from "@/lib/projects";
import { exportExcel } from "@/lib/export";
import logoAsset from "@/assets/metal-fuze-logo.png.asset.json";
import logoLightAsset from "@/assets/metal-fuze-logo-light.png.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "METAL FUZE PROJECTS" },
      { name: "description", content: "داشبورد متابعة مشاريع Metal Fuze: الإنجاز، العقود، المدفوعات والتنبيهات." },
      { property: "og:title", content: "METAL FUZE PROJECTS" },
      { property: "og:description", content: "متابعة حالة المشاريع والعقود والمدفوعات لحظياً." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const tip = {
  contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--foreground)" },
  itemStyle: { color: "var(--foreground)" },
};

function statusClass(s: string) {
  if (s.includes("متأخر")) return "bg-destructive/15 text-destructive border-destructive/30";
  if (s.includes("متقدم")) return "bg-success/15 text-success border-success/30";
  if (s) return "bg-info/15 text-info border-info/30";
  return "bg-muted text-muted-foreground";
}

function groupBy(list: Project[], key: (p: Project) => string, val: (p: Project) => number = () => 1) {
  const m = new Map<string, number>();
  list.forEach((p) => { const k = key(p) || "غير محدد"; m.set(k, (m.get(k) ?? 0) + val(p)); });
  return [...m.entries()].map(([name, value]) => ({ name, value }));
}

function Dashboard() {
  useLanguage();
  const projects = useProjects();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("الكل");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const s = useMemo(() => {
    const contract = projects.reduce((a, p) => a + (p.contract || 0), 0);
    const paid = projects.reduce((a, p) => a + (p.paid || 0), 0);
    const withProg = projects.filter((p) => p.progress > 0);
    const avg = withProg.length ? withProg.reduce((a, p) => a + p.progress, 0) / withProg.length : 0;
    const late = projects.filter((p) => p.status.includes("متأخر")).length;
    const overdue = projects.filter((p) => { const d = daysLeft(p.end); return d !== null && d < 0 && p.progress < 1; });
    const soon = projects.filter((p) => { const d = daysLeft(p.end); return d !== null && d >= 0 && d <= 14 && p.progress < 1; });
    return { contract, paid, remaining: contract - paid, avg, late, overdue, soon };
  }, [projects]);

  const tableRef = useRef<HTMLElement>(null);
  function scrollToTable(filter?: string) {
    if (filter) setStatus(filter);
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const managers = useMemo(() => [...new Set(projects.map((p) => p.manager).filter(Boolean))], [projects]);
  const byStatus = useMemo(() => groupBy(projects, (p) => p.status), [projects]);
  const bySector = useMemo(() => groupBy(projects, (p) => p.sector, (p) => p.contract), [projects]);
  const byManager = useMemo(() => groupBy(projects, (p) => p.manager), [projects]);
  const progressData = useMemo(
    () => projects.map((p) => ({ name: p.name, فعلي: Math.round(p.progress * 100), مخطط: Math.round(p.planned * 100) })),
    [projects],
  );

  const filtered = projects.filter(
    (p) =>
      (status === "الكل" || p.status === status) &&
      [p.name, p.code, p.manager, p.sector].join(" ").toLowerCase().includes(q.toLowerCase()),
  );
  const statuses = ["الكل", ...new Set(projects.map((p) => p.status).filter(Boolean))];

  async function onImport(file: File) {
    try {
      const list = await importExcel(file);
      projectStore.replaceAll(list);
      toast.success(`تم تحديث البيانات: ${list.length} مشروع`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col items-center gap-4 text-center">
        <img src={logoAsset.url} alt="Metal Fuze — Accuracy Has No Limit" width={1600} height={665}
          className="screen-logo logo-on-light h-auto w-72 max-w-full sm:w-96" />
        <img src={logoLightAsset.url} alt="Metal Fuze — Accuracy Has No Limit" width={1600} height={665}
          className="screen-logo logo-on-dark hidden h-auto w-72 max-w-full sm:w-96" />
        <div>
          <h1 className="font-display text-3xl font-extrabold sm:text-4xl">{t("لوحة متابعة المشاريع")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {new Date().toLocaleDateString(locale(), { dateStyle: "full" })}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2 print:hidden">
          <input ref={fileRef} type="file" accept=".xlsx,.xls" hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = ""; }} />
          <ThemeToggle />
          <Button variant="outline" asChild>
            <Link to="/assistant"><BrainCircuit /> {t("المستشار الذكي")}</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/payroll"><Banknote /> {t("الرواتب")}</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/budget"><Banknote /> {t("الميزانية")}</Link>
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <FileSpreadsheet /> {t("تحديث من ملف Excel")}</Button>
          <Button variant="outline" onClick={async () => { try { await exportExcel(projects); toast.success(t("تم تصدير تقرير Excel")); } catch { toast.error(t("تعذر التصدير")); } }}>
            <FileDown /> {t("تصدير تقرير Excel")}</Button>
          <PdfButton />
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus /> {t("مشروع جديد")}</Button>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={<FolderKanban />} label={t("إجمالي المشاريع")} value={String(projects.length)} sub={`${s.late} ${t("متأخر")}`} />
        <Kpi icon={<Banknote />} label={t("إجمالي قيمة العقود")} value={fmtMoney(s.contract)} sub={t("ريال")} accent />
        <Kpi icon={<TrendingUp />} label={t("المدفوع")} value={fmtMoney(s.paid)}
          sub={`${t("نسبة الصرف")} ${fmtPct(s.contract ? s.paid / s.contract : 0)}`} />
        <Kpi icon={<Banknote />} label={t("المتبقي للدفع")} value={fmtMoney(s.remaining)} sub={`${t("متوسط الإنجاز")} ${fmtPct(s.avg)}`} />
      </section>

      {(s.overdue.length > 0 || s.soon.length > 0) && (
        <section className="space-y-3 print:hidden">
          {s.overdue.length > 0 && (
            <div className="surface flex flex-wrap items-center gap-3 border-destructive/40 p-4">
              <CircleAlert className="size-5 text-destructive" />
              <span className="font-semibold text-destructive">{t("مشاريع متأخرة (")}{s.overdue.length}):</span>
              {s.overdue.map((p) => (
                <button key={p.id} onClick={() => scrollToTable()} className="transition-transform hover:scale-105">
                  <Badge variant="outline" className="cursor-pointer border-destructive/40 text-destructive">
                    {p.name} {t("— متأخر")}{Math.abs(daysLeft(p.end) ?? 0)} {t("يوم")}</Badge>
                </button>
              ))}
            </div>
          )}
          {s.soon.length > 0 && (
            <div className="surface flex flex-wrap items-center gap-3 border-warning/30 p-4">
              <AlertTriangle className="size-5 text-warning" />
              <span className="font-semibold text-warning">{t("قريبة من الانتهاء (")}{s.soon.length}):</span>
              {s.soon.map((p) => (
                <button key={p.id} onClick={() => scrollToTable()} className="transition-transform hover:scale-105">
                  <Badge variant="outline" className="cursor-pointer border-warning/40 text-warning">
                    {p.name} {t("— باقي")}{daysLeft(p.end)} {t("يوم")}</Badge>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-3 print:hidden">
        <Panel title={t("حالة المشاريع")}>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={byStatus} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3} stroke="none">
                {byStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip {...tip} />
            </PieChart>
          </ResponsiveContainer>
          <Legend data={byStatus} />
        </Panel>
        <Panel title={t("قيمة العقود حسب القطاع")}>
          <ResponsiveContainer width="100%" height={270}>
            <BarChart data={bySector}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
              <YAxis orientation="right" width={50} tickFormatter={(v) => `${Math.round(v / 1000)}k`} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
              <Tooltip {...tip} formatter={(v: number) => fmtMoney(v)} cursor={{ fill: "var(--muted)" }} />
              <Bar dataKey="value" name={t("القيمة")} radius={[6, 6, 0, 0]} fill="var(--chart-1)" />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title={t("المشاريع لكل مدير")}>
          <ResponsiveContainer width="100%" height={270}>
            <BarChart data={byManager} layout="vertical">
              <XAxis type="number" hide allowDecimals={false} />
              <YAxis type="category" dataKey="name" orientation="right" width={130} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
              <Tooltip {...tip} cursor={{ fill: "var(--muted)" }} />
              <Bar dataKey="value" name={t("عدد المشاريع")} radius={[6, 0, 0, 6]} fill="var(--chart-2)" />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </section>

      <div className="print:hidden">
      <Panel title={t("الإنجاز الفعلي مقابل المخطط")}>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={progressData}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={70} />
            <YAxis orientation="right" unit="%" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
            <Tooltip {...tip} formatter={(v: number) => `${v}%`} cursor={{ fill: "var(--muted)" }} />
            <Bar dataKey={t("مخطط")} fill="var(--muted-foreground)" radius={[4, 4, 0, 0]} />
            <Bar dataKey={t("فعلي")} fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>
      </div>

      <section ref={tableRef} className="surface overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <h2 className="font-display text-lg font-bold">{t("جميع المشاريع (")}{filtered.length})</h2>
          <div className="flex flex-wrap gap-2 print:hidden">
            {statuses.map((st) => (
              <Button key={st} size="sm" variant={status === st ? "default" : "outline"} onClick={() => setStatus(st)}>{t(st)}</Button>
            ))}
            <div className="relative">
              <Search className="absolute right-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("بحث...")} className="h-9 w-48 pr-8" />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                {[t("الرمز"), t("المشروع"), t("القطاع"), t("المدير"), t("الانتهاء"), t("الحالة"), t("الإنجاز"), t("قيمة العقد"), t("المدفوع"), t("المتبقي للدفع"), ""].map((h) => (
                  <th key={h} className={`whitespace-nowrap px-3 py-3 text-right font-medium ${h === "" ? "print:hidden" : ""}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const d = daysLeft(p.end);
                return (
                  <tr key={p.id} className="border-t transition-colors hover:bg-muted/30">
                    <td className="px-3 py-3 text-muted-foreground">{p.code}</td>
                    <td className="px-3 py-3 font-medium">
                      {p.name}
                      {p.issues && <p className="mt-0.5 line-clamp-1 max-w-xs text-xs text-destructive/80">{p.issues}</p>}
                    </td>
                    <td className="px-3 py-3">{t(p.sector)}</td>
                    <td className="whitespace-nowrap px-3 py-3" dir="ltr">{p.manager}</td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {p.end ?? "—"}
                      {d !== null && <p className={`text-xs ${d < 0 ? "text-destructive" : d <= 30 ? "text-warning" : "text-muted-foreground"}`}>{deadlineAlert(p.end)} ({d})</p>}
                    </td>
                    <td className="px-3 py-3">{p.status && <Badge variant="outline" className={statusClass(p.status)}>{t(p.status)}</Badge>}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                          <div className="h-full bg-primary" style={{ width: `${Math.min(100, p.progress * 100)}%` }} />
                        </div>
                        <span className="text-xs">{fmtPct(p.progress)}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 tabular-nums">{fmtMoney(p.contract)}</td>
                    <td className="px-3 py-3 tabular-nums">{fmtMoney(p.paid)}</td>
                    <td className="px-3 py-3 tabular-nums">{fmtMoney(p.contract - p.paid)}</td>
                    <td className="whitespace-nowrap px-3 py-3 print:hidden">
                      <Button size="icon" variant="ghost" aria-label={t("تعديل")} onClick={() => { setEditing(p); setOpen(true); }}><Pencil /></Button>
                      <Button size="icon" variant="ghost" aria-label={t("حذف")}
                        onClick={() => { if (confirm(`${t("حذف")} ${p.name}?`)) projectStore.remove(p.id); }}><Trash2 /></Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <ProjectDialog open={open} onOpenChange={setOpen} project={editing} managers={managers} />
    </div>
  );
}

function Kpi({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: string; sub: string; accent?: boolean }) {
  useLanguage();
  return (
    <div className="surface p-5">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-sm">{label}</span>
        <span className="text-primary [&_svg]:size-5">{icon}</span>
      </div>
      <p className={`mt-3 font-display text-3xl font-extrabold tabular-nums ${accent ? "text-primary" : ""}`}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  useLanguage();
  return (
    <div className="surface p-5">
      <h2 className="mb-3 font-display text-lg font-bold">{title}</h2>
      {children}
    </div>
  );
}

function Legend({ data }: { data: { name: string; value: number }[] }) {
  useLanguage();
  return (
    <div className="flex flex-wrap justify-center gap-3 text-xs">
      {data.map((d, i) => (
        <span key={d.name} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
          {t(d.name)} ({d.value})
        </span>
      ))}
    </div>
  );
}
