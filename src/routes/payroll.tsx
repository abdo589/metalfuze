import { useCanEditHr } from "@/lib/permissions";
import { t, useLanguage, locale } from "@/lib/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Banknote, CheckCircle2, Eye, FileDown, Pencil, Plus, Search, Trash2, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmployeeDialog } from "@/components/EmployeeDialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PdfButton } from "@/components/PdfButton";
import { fmtMoney } from "@/lib/projects";
import { summarize } from "@/lib/attendance";
import { useMonthPunches } from "@/lib/attendance-data";
import { availableMonths, forMonth, paidFor, withPaid, monthKey, monthLabel, netSalary, payrollStore, usePayroll, type Employee } from "@/lib/payroll";
import { supabase } from "@/integrations/supabase/client";
import { useApprovedLeaves } from "@/lib/leave-data";
import { unpaidDaysInMonth, unpaidDeduction } from "@/lib/leave-engine";
import { useAdjustments } from "@/lib/advances";

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

function Payroll() {
  const canEdit = useCanEditHr();
  useLanguage();
  const rawEmployees = usePayroll();
  const [month, setMonth] = useState(monthKey());
  const employees = useMemo(() => rawEmployees.map((e) => forMonth(e, month)), [rawEmployees, month]);
  /** Month options generated from the data: earliest join/salary/paid month to the current month. */
  const monthsList = useMemo(() => availableMonths(rawEmployees), [rawEmployees]);
  const punches = useMonthPunches(month);
  const [excuses, setExcuses] = useState<{ employee_id: string; excuse_date: string }[]>([]);
  useEffect(() => {
    supabase.from("late_excuses").select("employee_id,excuse_date").then(({ data }) => { if (data) setExcuses(data); });
  }, []);
  const excuseSets = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const x of excuses) { const s = m.get(x.employee_id) ?? new Set<string>(); s.add(x.excuse_date); m.set(x.employee_id, s); }
    return m;
  }, [excuses]);
  /** Attendance summary honoring approved late excuses. */
  const leaves = useApprovedLeaves();
  const att = (e: Employee) => summarize(e, punches, month, excuseSets.get(e.id), leaves.dates.get(e.id));
  /** Unpaid-leave deduction for this month (gross / 30 per day). */
  const unpaid = (e: Employee) => { const d = unpaidDaysInMonth(leaves.reqs, leaves.types, e.id, month); return { days: d, amount: unpaidDeduction((e.base || 0) + (e.allowances || 0), d) }; };
  const adj = useAdjustments(month);
  /** Net after unpaid leave, advances (deducted) and commissions (added) for this month. */
  const finalNet = (e: Employee) => netSalary(e) - unpaid(e).amount - (adj.get(e.id)?.advances ?? 0) + (adj.get(e.id)?.commissions ?? 0);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);

  const active = employees.filter((e) => e.active);
  const s = useMemo(() => {
    const total = active.reduce((a, e) => a + finalNet(e), 0);
    const paidList = active.filter((e) => e.paidMonths.includes(month));
    const paidSum = paidList.reduce((a, e) => a + finalNet(e), 0);
    return { total, paidCount: paidList.length, paidSum, remaining: total - paidSum };
  }, [active, month, adj]);

  const filtered = employees.filter((e) =>
    [e.name, e.role, e.dept, e.project].join(" ").toLowerCase().includes(q.toLowerCase()),
  );

  async function onExport() {
    try {
      const { exportBrandedExcel } = await import("@/lib/branded-excel");
      const total = active.reduce((x, e) => x + finalNet(e), 0);
      const paidN = active.filter((e) => e.paidMonths.includes(month)).reduce((x, e) => x + finalNet(e), 0);
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
            { header: t("رقم الموظف"), width: 12 }, { header: t("الموظف"), width: 22 }, { header: t("المسمى"), width: 18 },
            { header: t("الإدارة") }, { header: t("المشروع"), width: 28 }, { header: t("رقم البصمة"), width: 12 },
            { header: t("الأساسي"), format: "money" }, { header: t("البدلات"), format: "money" },
            { header: t("الخصومات"), format: "money" }, { header: t("الصافي"), format: "money" },
            { header: t("تاريخ التعيين"), width: 16 }, { header: t("الحالة"), width: 12 }, { header: t("نشط"), width: 12 },
            { header: t("أيام الحضور"), format: "int" }, { header: t("أيام التأخير"), format: "int" }, { header: t("أيام الغياب"), format: "int" },
            { header: t("الشهور المدفوعة"), width: 30 },
          ],
          rows: employees.map((e) => {
            const a = att(e);
            return [e.id, e.name, e.role || "—", e.dept || "—", e.project || "—", e.deviceUserId || "—",
              e.base, e.allowances, e.deductions + (adj.get(e.id)?.advances ?? 0), finalNet(e),
              e.joined ? new Date(e.joined).toLocaleDateString(locale()) : "—",
              e.paidMonths.includes(month) ? t("مدفوع") : t("غير مدفوع"),
              e.active ? t("نشط") : t("غير نشط"),
              a.present, a.late, a.absent,
              [...e.paidMonths].sort().join("، ") || "—"];
          }),
          totals: [6, 7, 8, 9, 13, 14, 15],
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

      {/* اختيار الشهر — قائمة متولدة من البيانات */}
      <div className="flex items-center justify-center gap-3">
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          aria-label={t("اختيار الشهر")}
          className="h-10 min-w-48 rounded-md border border-input bg-background px-3 text-center font-display text-lg font-bold"
        >
          {monthsList.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
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
                <th className="p-3 font-medium">{t("الحضور والانصراف")}</th>
                <th className="p-3 font-medium">{t("حالة")} {monthLabel(month)}</th>
                <th className="p-3 font-medium">{t("اتصرف")} {monthLabel(month)}</th>
                <th className="p-3 font-medium">{t("الباقي")} {monthLabel(month)}</th>
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
                    <td className="p-3 font-bold">{fmtMoney(finalNet(e))}
                      {unpaid(e).days > 0 && <div className="text-xs font-normal text-destructive">{t("بدون راتب")}: {unpaid(e).days} − {fmtMoney(unpaid(e).amount)}</div>}
                      {(adj.get(e.id)?.advances ?? 0) > 0 && <div className="text-xs font-normal text-destructive">{t("سلف")}: − {fmtMoney(adj.get(e.id)!.advances)}</div>}
                      {(adj.get(e.id)?.commissions ?? 0) > 0 && <div className="text-xs font-normal text-success">{t("عمولات")}: + {fmtMoney(adj.get(e.id)!.commissions)}</div>}
                    </td>
                    <td className="p-3 text-xs">{(() => { const a = att(e); return a.linked ? (
                      <div className="space-y-0.5"><div>{t("حضور")}: <b>{a.present}</b></div>
                        <div className="text-warning">{t("تأخير")}: {a.late}</div>
                        <div className="text-destructive">{t("غياب")}: {a.absent}</div></div>
                    ) : <span className="text-muted-foreground">{t("غير مربوط بالبصمة")}</span>; })()}</td>
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
                    <td className="p-3 text-xs">{(() => { const net = finalNet(e); const p = paidFor(e, month, net); return <button disabled={!canEdit} className="text-start" title={t("تعديل المبلغ المصروف")} onClick={() => { const v = window.prompt(t("المبلغ اللي اتصرف هذا الشهر"), String(p)); if (v === null || isNaN(Number(v))) return; payrollStore.upsert(withPaid(e, month, Number(v))); }}><span className="text-success">{t("اتصرف")}: <b>{fmtMoney(p)}</b></span></button>; })()}</td>
                    <td className="p-3 text-xs">{(() => { const net = finalNet(e); const p = paidFor(e, month, net); return <span className={net - p > 0 ? "text-warning" : "text-muted-foreground"}>{t("باقي")}: <b>{fmtMoney(net - p)}</b></span>; })()}</td>
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
          const orig = rawEmployees.find((x) => x.id === e.id);
          if (orig) {
            // تعديل المبالغ يُحفظ لهذا الشهر وما بعده فقط؛ الشهور السابقة تبقى كما هي
            const pay = { base: Number(e.base) || 0, allowances: Number(e.allowances) || 0, deductions: Number(e.deductions) || 0 };
            payrollStore.upsert({ ...e, base: orig.base, allowances: orig.allowances, deductions: orig.deductions, monthly: { ...(orig.monthly ?? {}), [month]: pay } });
          } else payrollStore.upsert({ ...e, monthly: { [month]: { base: e.base, allowances: e.allowances, deductions: e.deductions } } });
          toast.success(editing ? t("تم تحديث بيانات الموظف") : t("تمت إضافة الموظف"));
        }}
      />
    </div>
  );
}
