import { useCanEdit } from "@/lib/permissions";
import { t, useLanguage, locale } from "@/lib/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, Banknote, CheckCircle2, ChevronLeft, ChevronRight, FileDown, Pencil, Plus, Search, Trash2, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmployeeDialog } from "@/components/EmployeeDialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PdfButton } from "@/components/PdfButton";
import { fmtMoney } from "@/lib/projects";
import { monthKey, monthLabel, netSalary, payrollStore, usePayroll, type Employee } from "@/lib/payroll";

export const Route = createFileRoute("/payroll")({
  head: () => ({
    meta: [
      { title: "وحدة الرواتب — Metal Fuze" },
      { name: "description", content: "إدارة رواتب موظفي Metal Fuze: المسير الشهري، البدلات، الخصومات وحالة الصرف." },
      { property: "og:title", content: "وحدة الرواتب — Metal Fuze" },
      { property: "og:description", content: "مسير الرواتب الشهري وحالة الصرف لكل موظف." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Payroll,
});

function shiftMonth(key: string, delta: number) {
  const [y, m] = key.split("-").map(Number);
  return monthKey(new Date(y!, (m ?? 1) - 1 + delta, 1));
}

function Payroll() {
  const canEdit = useCanEdit();
  useLanguage();
  const employees = usePayroll();
  const [month, setMonth] = useState(monthKey());
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);

  const active = employees.filter((e) => e.active);
  const s = useMemo(() => {
    const total = active.reduce((a, e) => a + netSalary(e), 0);
    const paidList = active.filter((e) => e.paidMonths.includes(month));
    const paidSum = paidList.reduce((a, e) => a + netSalary(e), 0);
    return { total, paidCount: paidList.length, paidSum, remaining: total - paidSum };
  }, [active, month]);

  const filtered = employees.filter((e) =>
    [e.name, e.role, e.dept, e.project].join(" ").toLowerCase().includes(q.toLowerCase()),
  );

  async function onExport() {
    try {
      const { exportBrandedExcel } = await import("@/lib/branded-excel");
      const total = active.reduce((x, e) => x + netSalary(e), 0);
      const paidN = active.filter((e) => e.paidMonths.includes(month)).reduce((x, e) => x + netSalary(e), 0);
      await exportBrandedExcel({
        filename: `${locale() === "en-GB" ? "Payroll" : "مسير-رواتب"}-${month}.xlsx`,
        reportTitle: `${t("مسير الرواتب")} — ${month}`,
        summary: [
          [t("عدد الموظفين"), active.length, "int"],
          [t("إجمالي صافي الرواتب"), total, "money"],
          [t("المدفوع"), paidN, "money"],
          [t("المتبقي للصرف"), total - paidN, "money"],
        ],
        sheets: [{
          name: t("مسير الرواتب"),
          title: `${t("مسير الرواتب")} — ${monthLabel(month)}`,
          columns: [
            { header: t("الموظف"), width: 22 }, { header: t("المسمى"), width: 18 }, { header: t("الإدارة") },
            { header: t("المشروع"), width: 28 }, { header: t("الأساسي"), format: "money" },
            { header: t("البدلات"), format: "money" }, { header: t("الخصومات"), format: "money" },
            { header: t("الصافي"), format: "money" }, { header: t("تاريخ التعيين"), width: 16 },
            { header: t("الحالة"), width: 12 }, { header: t("نشط"), width: 12 },
          ],
          rows: employees.map((e) => [e.name, e.role, e.dept || "—", e.project || "—", e.base, e.allowances, e.deductions,
            netSalary(e), e.joined ? new Date(e.joined).toLocaleDateString(locale()) : "—",
            e.paidMonths.includes(month) ? t("مدفوع") : t("غير مدفوع"),
            e.active ? t("نشط") : t("غير نشط")]),
          totals: [4, 5, 6, 7],
        }],
      });
      toast.success(t("تم تصدير مسير الرواتب"));
    } catch {
      toast.error(t("تعذر التصدير"));
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col items-center gap-4 text-center">
        <div>
          <h1 className="font-display text-3xl font-extrabold sm:text-4xl">{t("وحدة الرواتب")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("مسير الرواتب الشهري وحالة الصرف لكل موظف")}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2 print:hidden">
          <ThemeToggle />
          <Button variant="outline" asChild>
            <Link to="/"><ArrowRight /> {t("لوحة المشاريع")}</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/report"><FileDown /> {t("التقرير الشهري")}</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/budget">{t("الميزانية")}</Link>
          </Button>
          <Button variant="outline" onClick={onExport}>
            <FileDown /> {t("تصدير مسير Excel")}</Button>
          <PdfButton />
          {canEdit && <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus /> {t("إضافة موظف")}</Button>}
        </div>
      </header>

      {/* اختيار الشهر */}
      <div className="flex items-center justify-center gap-3">
        <Button variant="outline" size="icon" onClick={() => setMonth(shiftMonth(month, 1))} aria-label={t("الشهر التالي")}>
          <ChevronRight />
        </Button>
        <div className="min-w-40 text-center font-display text-lg font-bold">{monthLabel(month)}</div>
        <Button variant="outline" size="icon" onClick={() => setMonth(shiftMonth(month, -1))} aria-label={t("الشهر السابق")}>
          <ChevronLeft />
        </Button>
        {month !== monthKey() && (
          <Button variant="ghost" size="sm" onClick={() => setMonth(monthKey())}>{t("الشهر الحالي")}</Button>
        )}
      </div>

      {/* مؤشرات */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: t("إجمالي رواتب الشهر"), value: `${fmtMoney(s.total)} ${t("ر.س")}`, icon: Banknote },
          { label: t("الموظفون النشطون"), value: active.length, icon: Users },
          { label: t("تم صرفه"), value: `${fmtMoney(s.paidSum)} ${t("ر.س")} (${s.paidCount})`, icon: CheckCircle2 },
          { label: t("المتبقي للصرف"), value: `${fmtMoney(s.remaining)} ${t("ر.س")}`, icon: Wallet },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <k.icon className="size-4" />
              <span className="text-xs">{k.label}</span>
            </div>
            <div className="mt-2 font-display text-xl font-bold">{k.value}</div>
          </div>
        ))}
      </div>

      {/* جدول الرواتب */}
      <section className="rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4 print:hidden">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("بحث بالاسم أو الإدارة أو المشروع…")} className="pr-9" />
          </div>
          {canEdit && <Button
            variant="outline"
            onClick={() => { payrollStore.payAll(month); toast.success(`${t("تم اعتماد صرف الرواتب")} ${monthLabel(month)}`); }}
          >
            <CheckCircle2 /> {t("اعتماد صرف الشهر للجميع")}</Button>}
          {canEdit && <Button
            variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={() => {
              if (!window.confirm(t("هل تريد حذف جميع الموظفين نهائيًا؟"))) return;
              payrollStore.clearAll();
              toast.success(t("تم حذف جميع الموظفين"));
            }}
          >
            <Trash2 /> {t("حذف كل الموظفين")}</Button>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-border text-right text-xs text-muted-foreground">
                <th className="p-3 font-medium">{t("الموظف")}</th>
                <th className="p-3 font-medium">{t("الإدارة / المشروع")}</th>
                <th className="p-3 font-medium">{t("الأساسي")}</th>
                <th className="p-3 font-medium">{t("البدلات")}</th>
                <th className="p-3 font-medium">{t("الخصومات")}</th>
                <th className="p-3 font-medium">{t("الصافي")}</th>
                <th className="p-3 font-medium">{t("حالة")} {monthLabel(month)}</th>
                <th className="p-3 font-medium print:hidden">{t("إجراءات")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => {
                const paid = e.paidMonths.includes(month);
                return (
                  <tr key={e.id} className="border-b border-border/60 last:border-0 hover:bg-muted/40">
                    <td className="p-3">
                      <div className="font-medium">{e.name}</div>
                      <div className="text-xs text-muted-foreground">{e.role}</div>
                    </td>
                    <td className="p-3">
                      <div>{e.dept || "—"}</div>
                      {e.project && <div className="text-xs text-muted-foreground">{e.project}</div>}
                    </td>
                    <td className="p-3">{fmtMoney(e.base)}</td>
                    <td className="p-3 text-success">{fmtMoney(e.allowances)}</td>
                    <td className="p-3 text-destructive">{fmtMoney(e.deductions)}</td>
                    <td className="p-3 font-bold">{fmtMoney(netSalary(e))}</td>
                    <td className="p-3">
                      {e.active ? (
                        <button
                          onClick={() => canEdit && payrollStore.togglePaid(e.id, month)}
                          disabled={!canEdit}
                          className={canEdit ? "cursor-pointer" : "cursor-default"}
                          title={paid ? t("إلغاء الصرف") : t("اعتماد الصرف")}
                        >
                          <Badge variant="outline" className={paid
                            ? "border-success/30 bg-success/15 text-success"
                            : "border-warning/30 bg-warning/15 text-warning"}>
                            {paid ? t("مدفوع ✓") : t("قيد الصرف")}
                          </Badge>
                        </button>
                      ) : (
                        <Badge variant="outline" className="bg-muted text-muted-foreground">{t("غير نشط")}</Badge>
                      )}
                    </td>
                    <td className="p-3 print:hidden">
                      {canEdit && <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => { setEditing(e); setOpen(true); }} aria-label={t("تعديل")}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost" size="icon" aria-label={t("حذف")}
                          onClick={() => {
                            if (confirm(`${t("حذف")} ${e.name}?`)) {
                              payrollStore.remove(e.id);
                              toast.success(t("تم حذف الموظف"));
                            }
                          }}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">{t("لا توجد نتائج مطابقة")}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <EmployeeDialog
        open={open}
        onOpenChange={setOpen}
        employee={editing}
        onSave={(e) => {
          payrollStore.upsert(e);
          toast.success(editing ? t("تم تحديث بيانات الموظف") : t("تمت إضافة الموظف"));
        }}
      />
    </div>
  );
}
