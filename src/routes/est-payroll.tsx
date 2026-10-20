import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Banknote, CheckCircle2, Clock, Pencil, Plus, Trash2, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useCanEditHr } from "@/lib/permissions";
import { t, useLanguage } from "@/lib/i18n";
import { StatCard } from "@/components/ResidenciesPanel";
import { PdfButton } from "@/components/PdfButton";

export const Route = createFileRoute("/est-payroll")({
  head: () => ({
    meta: [
      { title: "رواتب المؤسسة — Metal Fuze" },
      { name: "description", content: "مسير رواتب موظفي المؤسسة الشهري مرتبط بملف المؤسسة." },
      { property: "og:title", content: "رواتب المؤسسة — Metal Fuze" },
      { property: "og:description", content: "رواتب موظفي المؤسسة: الأساسي والبدلات والخصومات والصافي وحالة الصرف." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EstPayrollPage,
});

type D = Record<string, string | number>;
type Rec = { id: string; sheet: string; data: D; sort: number };
const N = (v: unknown) => Number(v) || 0;
const fmt = (n: number) => n.toLocaleString("en-US");
const netOf = (d: D) => N(d["الراتب الأساسي"]) + N(d["البدلات"]) + N(d["الإضافي"]) - N(d["الخصومات"]);
const thisMonth = () => new Date().toISOString().slice(0, 7);
const STATUSES = ["تم الصرف", "لم يتم الصرف", "معلق"];

function EstPayrollPage() {
  useLanguage();
  const canEdit = useCanEditHr();
  const [rows, setRows] = useState<Rec[]>([]);
  const [month, setMonth] = useState("");
  const [edit, setEdit] = useState<{ id?: string; data: D } | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("est_records").select("*").in("sheet", ["employees", "payroll"]).order("sort");
    setRows((data ?? []) as Rec[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  const emps = rows.filter((r) => r.sheet === "employees");
  const pay = rows.filter((r) => r.sheet === "payroll");
  const months = useMemo(() => [...new Set(pay.map((r) => String(r.data["الشهر"] ?? "")).filter(Boolean))].sort().reverse(), [rows]);
  const list = pay.filter((r) => !month || String(r.data["الشهر"] ?? "") === month);
  const total = list.reduce((s, r) => s + netOf(r.data), 0);
  const paid = list.filter((r) => String(r.data["حالة الصرف"] ?? "").includes("تم")).length;

  function pickEmp(id: string) {
    const e = emps.find((x) => String(x.data["رقم الموظف"]) === id);
    if (!edit || !e) return;
    const d = e.data;
    setEdit({ ...edit, data: { ...edit.data, "رقم الموظف": id, "اسم الموظف": d["اسم الموظف"] ?? "", "القسم": d["القسم"] ?? "",
      "الراتب الأساسي": edit.data["الراتب الأساسي"] ?? d["الراتب الأساسي"] ?? 0, "البدلات": edit.data["البدلات"] ?? d["البدلات"] ?? 0 } });
  }
  async function save() {
    if (!edit) return;
    if (!edit.data["رقم الموظف"]) { toast.error(t("اختر الموظف")); return; }
    const data: D = { ...edit.data };
    for (const k of ["الراتب الأساسي", "البدلات", "الخصومات", "الإضافي"]) data[k] = N(data[k]);
    data["صافي الراتب"] = netOf(data);
    const { error } = edit.id ? await supabase.from("est_records").update({ data }).eq("id", edit.id)
      : await supabase.from("est_records").insert({ sheet: "payroll", data, sort: pay.length });
    if (error) { toast.error(t("تعذر الحفظ")); return; }
    toast.success(t("تم الحفظ")); setEdit(null); load();
  }
  async function remove(id: string) {
    if (!confirm(t("حذف هذا السجل نهائيًا؟"))) return;
    const { error } = await supabase.from("est_records").delete().eq("id", id);
    if (error) { toast.error(t("تعذر الحذف")); return; }
    load();
  }

  const set = (k: string, v: string) => edit && setEdit({ ...edit, data: { ...edit.data, [k]: v } });
  const cols = ["رقم الموظف", "اسم الموظف", "القسم", "الشهر", "الراتب الأساسي", "البدلات", "الخصومات", "الإضافي", "صافي الراتب", "حالة الصرف", "ملاحظات"];

  return (
    <main className="mx-auto max-w-7xl space-y-5 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Wallet className="size-6 text-primary" /> {t("رواتب المؤسسة")}</h1>
          <p className="text-sm text-muted-foreground">{t("رواتب موظفي المؤسسة فقط، مرتبطة بملف")} <Link to="/establishment" className="text-primary underline">{t("المؤسسة")}</Link></p>
        </div>
        <div className="flex gap-2 print:hidden">
          <select className="h-9 rounded-md border bg-background px-2 text-sm" value={month} onChange={(e) => setMonth(e.target.value)}>
            <option value="">{t("كل الشهور")}</option>
            {months.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <PdfButton />
          {canEdit && <Button onClick={() => setEdit({ data: { "الشهر": month || thisMonth(), "حالة الصرف": "لم يتم الصرف" } })}><Plus /> {t("إضافة راتب")}</Button>}
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label={t("موظفو المؤسسة")} value={emps.length} icon={<Users className="size-5 text-primary" />} cls="border-border bg-card" />
        <StatCard label={t("صافي الرواتب")} value={fmt(total)} icon={<Banknote className="size-5 text-primary" />} cls="border-border bg-card" />
        <StatCard label={t("تم الصرف")} value={paid} icon={<CheckCircle2 className="size-5 text-success" />} cls="border-success/40 bg-success/10" />
        <StatCard label={t("لم يتم الصرف")} value={list.length - paid} icon={<Clock className="size-5 text-warning" />} cls="border-warning/40 bg-warning/10" />
      </section>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50"><tr>
            {cols.map((h) => <th key={h} className="whitespace-nowrap p-2 text-start font-semibold">{t(h)}</th>)}
            {canEdit && <th className="p-2 print:hidden" />}
          </tr></thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id} className="border-t">
                {cols.map((c) => <td key={c} className="whitespace-nowrap p-2 tabular-nums">
                  {c === "صافي الراتب" ? <b>{fmt(netOf(r.data))}</b>
                    : ["الراتب الأساسي", "البدلات", "الخصومات", "الإضافي"].includes(c) ? fmt(N(r.data[c]))
                    : String(r.data[c] ?? "") || "—"}
                </td>)}
                {canEdit && <td className="p-2 print:hidden"><div className="flex gap-1">
                  <Button size="icon" variant="ghost" aria-label={t("تعديل")} onClick={() => setEdit({ id: r.id, data: { ...r.data } })}><Pencil /></Button>
                  <Button size="icon" variant="ghost" className="text-destructive" aria-label={t("حذف")} onClick={() => remove(r.id)}><Trash2 /></Button>
                </div></td>}
              </tr>
            ))}
            {!list.length && <tr><td colSpan={12} className="p-6 text-center text-muted-foreground">{t("لا توجد رواتب")}</td></tr>}
            {!!list.length && <tr className="border-t bg-muted/40 font-bold"><td className="p-2" colSpan={8}>{t("الإجمالي")}</td><td className="p-2 tabular-nums">{fmt(total)}</td><td colSpan={canEdit ? 3 : 2} /></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit?.id ? t("تعديل راتب") : t("إضافة راتب")}</DialogTitle></DialogHeader>
          {edit && <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm sm:col-span-2">{t("الموظف")}
              <select className="h-9 rounded-md border bg-background px-2" value={String(edit.data["رقم الموظف"] ?? "")} onChange={(e) => pickEmp(e.target.value)}>
                <option value="">{t("اختر الموظف")}</option>
                {emps.map((e) => <option key={e.id} value={String(e.data["رقم الموظف"])}>{String(e.data["رقم الموظف"])} — {String(e.data["اسم الموظف"] ?? "")}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm">{t("الشهر")}<Input type="month" value={String(edit.data["الشهر"] ?? "")} onChange={(e) => set("الشهر", e.target.value)} /></label>
            <label className="grid gap-1 text-sm">{t("حالة الصرف")}
              <select className="h-9 rounded-md border bg-background px-2" value={String(edit.data["حالة الصرف"] ?? "")} onChange={(e) => set("حالة الصرف", e.target.value)}>
                {[...new Set([String(edit.data["حالة الصرف"] ?? ""), ...STATUSES].filter(Boolean))].map((s) => <option key={s} value={s}>{t(s)}</option>)}
              </select>
            </label>
            {["الراتب الأساسي", "البدلات", "الخصومات", "الإضافي"].map((k) =>
              <label key={k} className="grid gap-1 text-sm">{t(k)}<Input type="number" value={String(edit.data[k] ?? "")} onChange={(e) => set(k, e.target.value)} /></label>)}
            <div className="rounded-md bg-muted p-2 text-sm sm:col-span-2">{t("صافي الراتب")}: <b>{fmt(netOf(edit.data))}</b></div>
            <label className="grid gap-1 text-sm sm:col-span-2">{t("ملاحظات")}<Input value={String(edit.data["ملاحظات"] ?? "")} onChange={(e) => set("ملاحظات", e.target.value)} /></label>
            <Button className="sm:col-span-2" onClick={save}>{t("حفظ")}</Button>
          </div>}
        </DialogContent>
      </Dialog>
    </main>
  );
}
