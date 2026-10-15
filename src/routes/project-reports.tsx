import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { format } from "date-fns";
import { arSA, enGB } from "date-fns/locale";
import { ArrowLeft, CalendarIcon, ChevronLeft, ChevronRight, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PdfButton } from "@/components/PdfButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { fmtMoney, fmtPct, useProjects } from "@/lib/projects";
import { buildProjectReport, periodLabels, shiftPeriod, type ReportPeriod } from "@/lib/project-report";
import { t, useLanguage, locale } from "@/lib/i18n";
import logo from "@/assets/metal-fuze-logo.png.asset.json";
import lightLogo from "@/assets/metal-fuze-logo-light.png.asset.json";

export const Route = createFileRoute("/project-reports")({
  head: () => ({ meta: [
    { title: "Project Reports | METAL FUZE PROJECTS" },
    { name: "description", content: "تقارير مشاريع أسبوعية وشهرية وسنوية بهوية Metal Fuze، مع ملخص الإدارة وتصدير PDF وExcel." },
    { property: "og:title", content: "Project Reports | METAL FUZE PROJECTS" },
    { property: "og:description", content: "Weekly, monthly and annual project reports with company-branded PDF and Excel exports." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: ProjectReports,
});

function ProjectReports() {
  const language = useLanguage();
  const projects = useProjects();
  const [period, setPeriod] = useState<ReportPeriod>("monthly");
  const [anchor, setAnchor] = useState(() => new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const today = format(new Date(), "yyyy-MM-dd");
  const report = buildProjectReport(projects, period, anchor, today);
  const title = t(period === "weekly" ? "التقرير الأسبوعي" : period === "monthly" ? "التقرير الشهري" : "التقرير السنوي");
  const dateLabel = (date: Date) => date.toLocaleDateString(locale(), { day: "numeric", month: "long", year: "numeric" });
  const rangeLabel = `${dateLabel(report.range.start)} — ${dateLabel(report.range.end)}`;
  const note = t("أرقام العقود والمدفوعات والإنجاز لقطة حالية تراكمية، وليست حركة مالية تاريخية للفترة.");
  const priorities = report.rows.filter((p) => report.delayed.includes(p) || p.issues || p.contract > p.paid);

  async function exportReport() {
    setExporting(true);
    try {
      const { exportBrandedExcel } = await import("@/lib/branded-excel");
      await exportBrandedExcel({
        filename: `METAL-FUZE-${period}-${report.range.from}-${report.range.to}.xlsx`,
        reportTitle: `METAL FUZE PROJECTS — ${title}`,
        summary: [[t("فترة التقرير"), rangeLabel], [t("تاريخ البيانات"), today], [t("عدد المشاريع"), report.rows.length, "int"], [t("إجمالي قيمة العقود"), report.contract, "money"], [t("المدفوع"), report.paid, "money"], [t("المتبقي للدفع"), report.remaining, "money"], [t("متوسط الإنجاز"), report.average, "pct"], [t("ملاحظات"), note]],
        sheets: [{ name: t("المشاريع"), title: rangeLabel, columns: [
          { header: t("الرمز"), width: 12 }, { header: t("المشروع"), width: 38 }, { header: t("المدير"), width: 24 },
          { header: t("تاريخ البداية"), width: 16 }, { header: t("تاريخ الانتهاء"), width: 16 }, { header: t("الحالة"), width: 18 },
          { header: t("الإنجاز"), format: "pct" }, { header: t("مخطط"), format: "pct" },
          { header: t("قيمة العقد"), width: 22, format: "money" }, { header: t("المدفوع"), width: 22, format: "money" }, { header: t("المتبقي للدفع"), width: 22, format: "money" },
        ], rows: report.rows.map((p) => [p.code, p.name, p.manager, p.start, p.end, t(p.status), p.progress, p.planned, p.contract, p.paid, p.contract - p.paid]), totals: [8, 9, 10] },
        { name: t("أولويات المتابعة"), title: rangeLabel, columns: [{ header: t("المشروع"), width: 40 }, { header: t("المدير"), width: 25 }, { header: t("ملاحظات"), width: 85 }], rows: priorities.map((p) => [p.name, p.manager, p.issues || t(report.delayed.includes(p) ? "معالجة تأخر التنفيذ" : "متابعة التحصيل")]) }],
      });
      toast.success(t("تم تصدير التقرير"));
    } catch { toast.error(t("تعذر التصدير")); }
    finally { setExporting(false); }
  }

  return <div className="mx-auto max-w-7xl space-y-7 px-4 py-7 sm:px-6">
    <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
      <Button variant="outline" asChild><Link to="/"><ArrowLeft />{t("لوحة المشاريع")}</Link></Button>
      <div className="flex flex-wrap gap-2"><ThemeToggle /><Button variant="outline" disabled={exporting} onClick={exportReport}><FileSpreadsheet />{t("تصدير Excel")}</Button><PdfButton /></div>
    </div>
    <header className="flex flex-col gap-5 border-b border-primary/30 pb-6 sm:flex-row sm:items-center sm:justify-between">
      <div><p className="mb-2 text-sm font-semibold text-primary">{t("تقارير المشاريع")}</p><h1 className="font-display text-3xl font-extrabold">METAL FUZE PROJECTS</h1><h2 className="mt-2 text-xl font-semibold">{title}</h2><p className="mt-2 text-sm text-muted-foreground" data-testid="report-range">{rangeLabel}</p></div>
      <div><img src={logo.url} className="screen-logo logo-on-light h-auto w-56" alt="Metal Fuze" /><img src={lightLogo.url} className="screen-logo logo-on-dark hidden h-auto w-56" alt="Metal Fuze" /><p className="mt-2 text-sm text-muted-foreground">{t("تاريخ البيانات")}: {today}</p></div>
    </header>
    <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
      <Tabs value={period} onValueChange={(value) => { if (value === "weekly" || value === "monthly" || value === "yearly") setPeriod(value); }} dir={language === "ar" ? "rtl" : "ltr"}>
        <TabsList>{(["weekly", "monthly", "yearly"] as const).map((value) => <TabsTrigger key={value} value={value}>{t(periodLabels[value])}</TabsTrigger>)}</TabsList>
      </Tabs>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" aria-label={t("الفترة السابقة")} onClick={() => setAnchor(shiftPeriod(period, anchor, -1))}><ChevronLeft /></Button>
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}><PopoverTrigger asChild><Button variant="outline" aria-label={t("اختيار تاريخ التقرير")}><CalendarIcon />{dateLabel(anchor)}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="center"><Calendar mode="single" selected={anchor} defaultMonth={anchor} locale={language === "ar" ? arSA : enGB} weekStartsOn={1} onSelect={(date) => { if (date) { setAnchor(date); setCalendarOpen(false); } }} className="pointer-events-auto p-3" /></PopoverContent></Popover>
        <Button variant="outline" size="icon" aria-label={t("الفترة التالية")} onClick={() => setAnchor(shiftPeriod(period, anchor, 1))}><ChevronRight /></Button>
        <Button variant="ghost" onClick={() => setAnchor(new Date())}>{t("الفترة الحالية")}</Button>
      </div>
    </div>
    <section data-pdf-keep className="space-y-4">
      <h2 className="font-display text-xl font-bold">{t("ملخص الإدارة")}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[[t("عدد المشاريع"), report.rows.length], [t("إجمالي قيمة العقود"), `${fmtMoney(report.contract)} ${t("ر.س")}`], [t("المدفوع"), `${fmtMoney(report.paid)} ${t("ر.س")}`], [t("المتبقي للدفع"), `${fmtMoney(report.remaining)} ${t("ر.س")}`]].map(([label, value]) => <div key={label} className="min-w-0 rounded-lg border bg-card p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 break-words text-2xl font-bold tabular-nums">{value}</p></div>)}</div>
      <div className="flex flex-wrap gap-x-8 gap-y-2 border-y py-3 text-sm"><span>{t("متوسط الإنجاز")}: <strong>{fmtPct(report.average)}</strong></span><span>{t("المشاريع المتأخرة")}: <strong>{report.delayed.length}</strong></span><span>{t("مواعيد الانتهاء خلال الفترة")}: <strong>{report.deadlines.length}</strong></span><span>{t("مشاريع دون تواريخ")}: <strong>{report.undated}</strong></span></div>
      <p className="text-sm text-muted-foreground">{note}</p>
    </section>
    <section className="space-y-3"><h2 className="font-display text-xl font-bold">{t("المشاريع المتداخلة مع الفترة")}</h2><div className="overflow-x-auto"><table className="w-full min-w-[860px] text-start text-sm"><thead className="bg-muted"><tr>{["المشروع", "المدير", "الانتهاء", "الإنجاز", "مخطط", "قيمة العقد", "المدفوع", "المتبقي للدفع"].map((label) => <th className="p-3 text-start font-medium" key={label}>{t(label)}</th>)}</tr></thead><tbody>{report.rows.map((p) => <tr key={p.id} className="border-b"><td className="p-3 font-medium">{p.name}</td><td className="p-3">{p.manager || "—"}</td><td className="p-3">{p.end || "—"}</td><td className="p-3">{fmtPct(p.progress)}</td><td className="p-3">{fmtPct(p.planned)}</td><td className="p-3 tabular-nums">{fmtMoney(p.contract)}</td><td className="p-3 tabular-nums">{fmtMoney(p.paid)}</td><td className="p-3 font-semibold tabular-nums">{fmtMoney(p.contract - p.paid)}</td></tr>)}{!report.rows.length && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">{t("لا توجد مشاريع خلال هذه الفترة")}</td></tr>}</tbody></table></div></section>
    <section className="space-y-3"><h2 className="font-display text-xl font-bold">{t("أولويات المتابعة")}</h2><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted"><tr>{["المشروع", "المدير", "ملاحظات"].map((label) => <th className="p-3 text-start" key={label}>{t(label)}</th>)}</tr></thead><tbody>{priorities.map((p) => <tr key={p.id} className="border-b"><td className="p-3 font-medium">{p.name}</td><td className="p-3">{p.manager || "—"}</td><td className="p-3">{p.issues || t(report.delayed.includes(p) ? "معالجة تأخر التنفيذ" : "متابعة التحصيل")}</td></tr>)}{!priorities.length && <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">{t("لا توجد أولويات معلقة")}</td></tr>}</tbody></table></div></section>
  </div>;
}