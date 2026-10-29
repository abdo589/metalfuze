import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock, DollarSign, Eye, FileText, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { EmployeeSignature } from "@/components/EmployeeSignature";
import { useCanEditHr } from "@/lib/permissions";
import { t, useLanguage } from "@/lib/i18n";
import { EMPLOYEE_STATUSES } from "@/lib/employee-status";
import { endOfService, leavePay, serviceYears, SETTLEMENT_STATUSES } from "@/lib/settlement";
import { PdfButton } from "@/components/PdfButton";

export const Route = createFileRoute("/settlements")({
  head: () => ({
    meta: [
      { title: "المخالصات وإنهاء الخدمة — Metal Fuze" },
      { name: "description", content: "إدارة مخالصات الموظفين وحساب مكافأة نهاية الخدمة ورصيد الإجازات." },
      { property: "og:title", content: "المخالصات وإنهاء الخدمة — Metal Fuze" },
      { property: "og:description", content: "مخالصات نهاية الخدمة لموظفي Metal Fuze." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettlementsPage,
});

type Emp = { id: string; name: string; base: number; allowances: number; joined: string | null };
type Row = {
  id: string; employee_id: string; employee_name: string; reason: string; last_day: string; joined: string | null;
  wage: number; eos: number; leave_days: number; leave_pay: number; other_dues: number; deductions: number;
  net: number; status: string; notes: string;
};
const REASONS = EMPLOYEE_STATUSES.filter((s) => s.key !== "active").map((s) => s.ar);
const fmt = (n: number) => Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);

function blank(): Omit<Row, "id"> {
  return { employee_id: "", employee_name: "", reason: REASONS[0]!, last_day: today(), joined: null, wage: 0, eos: 0,
    leave_days: 0, leave_pay: 0, other_dues: 0, deductions: 0, net: 0, status: "draft", notes: "" };
}

function SettlementsPage() {
  useLanguage();
  const canEdit = useCanEditHr();
  const [rows, setRows] = useState<Row[]>([]);
  const [emps, setEmps] = useState<Emp[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [q, setQ] = useState("");
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [contracts, setContracts] = useState<Record<string, Record<string, unknown>>>({});
  const [edit, setEdit] = useState<(Omit<Row, "id"> & { id?: string }) | null>(null);

  const load = useCallback(async () => {
    const [s, e, b, c] = await Promise.all([
      supabase.from("settlements").select("*").order("created_at", { ascending: false }),
      supabase.from("employees").select("id,name,base,allowances,joined").order("name"),
      supabase.rpc("leave_balances"),
      supabase.from("hr_records").select("data").eq("sheet", "employees"),
    ]);
    // Contract details from the employee file (هيئة الموظفين), keyed by employee number.
    if (c.data) setContracts(Object.fromEntries((c.data as { data: Record<string, unknown> }[])
      .map((r) => [String(r.data?.["رقم الموظف"] ?? "").trim(), r.data]).filter(([k]) => k)));
    if (s.data) setRows(s.data as Row[]);
    if (e.data) setEmps(e.data as Emp[]);
    if (b.data) setBalances(Object.fromEntries((b.data as { employee_id: string; remaining: number }[]).map((x) => [x.employee_id, Number(x.remaining) || 0])));
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => rows.filter((r) =>
    (!q || r.employee_name.includes(q) || r.employee_id.includes(q)) && (!reason || r.reason === reason) &&
    (!status || r.status === status) && (!from || r.last_day >= from) && (!to || r.last_day <= to)), [rows, q, reason, status, from, to]);

  const count = (k: string) => rows.filter((r) => r.status === k).length;
  const kpis = [
    { l: "إجمالي المخالصات", v: rows.length, icon: FileText },
    { l: "معتمدة", v: count("approved"), icon: CheckCircle2, hi: true },
    { l: "بانتظار المراجعة", v: count("review") + count("mgmt"), icon: Clock },
    { l: "مسودة", v: count("draft"), icon: Clock },
    { l: "تم الصرف", v: count("paid"), icon: DollarSign },
  ];

  function recalc(d: Omit<Row, "id"> & { id?: string }) {
    const eos = endOfService(d.wage, d.joined, d.last_day, d.reason);
    const lp = leavePay(d.wage, d.leave_days);
    return { ...d, eos, leave_pay: lp, net: Math.round((eos + lp + Number(d.other_dues) - Number(d.deductions)) * 100) / 100 };
  }
  function pickEmp(id: string) {
    const e = emps.find((x) => x.id === id);
    if (!e || !edit) return;
    const k = contracts[String(e.id).trim()] ?? {};
    const num = (v: unknown) => { const n = Number(String(v ?? "").replace(/,/g, "")); return Number.isFinite(n) && n > 0 ? n : 0; };
    const cWage = num(k["إجمالي الراتب"]) || (num(k["الراتب الأساسي"]) ? num(k["الراتب الأساسي"]) + num(k["البدلات"]) : 0);
    const cJoined = typeof k["تاريخ التعيين"] === "string" && /^\d{4}-\d{2}-\d{2}/.test(k["تاريخ التعيين"] as string) ? (k["تاريخ التعيين"] as string).slice(0, 10) : null;
    setEdit(recalc({ ...edit, employee_id: e.id, employee_name: String(k["اسم الموظف"] ?? "") || e.name, joined: cJoined ?? e.joined,
      wage: cWage || Number(e.base) + Number(e.allowances), leave_days: Math.max(0, Math.floor(balances[e.id] ?? 0)) }));
  }
  async function save() {
    if (!edit?.employee_id) { toast.error(t("اختر الموظف")); return; }
    const { id, ...body } = recalc(edit);
    const res = id ? await supabase.from("settlements").update({ ...body, updated_at: new Date().toISOString() }).eq("id", id)
      : await supabase.from("settlements").insert(body);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success(t("تم الحفظ")); setEdit(null); load();
  }
  async function remove(id: string) {
    if (!confirm(t("حذف المخالصة؟"))) return;
    await supabase.from("settlements").delete().eq("id", id); setEdit(null); load();
  }
  const st = (k: string) => SETTLEMENT_STATUSES.find((s) => s.key === k) ?? SETTLEMENT_STATUSES[0];
  const sel = "h-10 rounded-md border border-input bg-background px-3 text-sm";

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <header className="text-center">
        <h1 className="font-display text-3xl font-extrabold sm:text-4xl">{t("المخالصات وإنهاء الخدمة")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("إدارة جميع معاملات المخالصات وإنهاء خدمة الموظفين")}</p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map(({ l, v, icon: I, hi }) => (
          <div key={l} className={`flex items-center justify-between rounded-2xl border p-5 ${hi ? "border-primary/40 bg-primary/10" : "border-border bg-card"}`}>
            <div><div className="text-sm text-muted-foreground">{t(l)}</div><div className="mt-1 font-display text-2xl font-extrabold">{v}</div></div>
            <I className="size-7 text-primary" />
          </div>
        ))}
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute start-3 top-3 size-4 text-muted-foreground" />
            <Input className="ps-9" placeholder={t("ابحث باسم الموظف أو رقم الموظف...")} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className={sel} value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="">{t("جميع الأسباب")}</option>{REASONS.map((r) => <option key={r} value={r}>{t(r)}</option>)}
          </select>
          <Input type="date" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} aria-label={t("من تاريخ")} />
          <Input type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} aria-label={t("إلى تاريخ")} />
          <select className={sel} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{t("جميع الحالات")}</option>{SETTLEMENT_STATUSES.map((s) => <option key={s.key} value={s.key}>{t(s.label)}</option>)}
          </select>
          <PdfButton />
          {canEdit && <Button onClick={() => setEdit(blank())}><Plus /> {t("إنشاء مخالصة")}</Button>}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr className="text-right">
                {["#", "اسم الموظف", "رقم الموظف", "سبب إنهاء الخدمة", "تاريخ آخر يوم عمل", "المستحقات الصافية", "حالة المخالصة", "إجراءات"].map((h) => <th key={h} className="px-4 py-3 font-medium">{t(h)}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-3">{i + 1}</td>
                  <td className="px-4 py-3 font-medium">{r.employee_name}</td>
                  <td className="px-4 py-3">{r.employee_id}</td>
                  <td className="px-4 py-3">{t(r.reason)}</td>
                  <td className="px-4 py-3">{r.last_day}</td>
                  <td className="px-4 py-3 font-bold">{fmt(r.net)}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-3 py-1 text-xs font-medium ${st(r.status).cls}`}>{t(st(r.status).label)}</span></td>
                  <td className="px-4 py-3"><Button size="sm" variant="outline" onClick={() => setEdit({ ...r })}><Eye /> {t("عرض")}</Button></td>
                </tr>
              ))}
              {!filtered.length && <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">{t("لا توجد مخالصات")}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{edit?.id ? t("تفاصيل المخالصة") : t("إنشاء مخالصة")}</DialogTitle></DialogHeader>
          {edit && (
            <fieldset disabled={!canEdit} className="grid gap-3 sm:grid-cols-2">
              {edit.employee_id && <div className="sm:col-span-2"><EmployeeSignature empId={edit.employee_id} name={edit.employee_name} /></div>}
              <label className="space-y-1 text-sm sm:col-span-2">{t("الموظف")}
                <select className={`${sel} w-full`} value={edit.employee_id} onChange={(e) => pickEmp(e.target.value)}>
                  <option value="">—</option>{emps.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.id})</option>)}
                </select>
              </label>
              <label className="space-y-1 text-sm">{t("سبب إنهاء الخدمة")}
                <select className={`${sel} w-full`} value={edit.reason} onChange={(e) => setEdit(recalc({ ...edit, reason: e.target.value }))}>
                  {REASONS.map((r) => <option key={r} value={r}>{t(r)}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-sm">{t("حالة المخالصة")}
                <select className={`${sel} w-full`} value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>
                  {SETTLEMENT_STATUSES.map((s) => <option key={s.key} value={s.key}>{t(s.label)}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-sm">{t("تاريخ التعيين")}<Input type="date" value={edit.joined ?? ""} onChange={(e) => setEdit(recalc({ ...edit, joined: e.target.value || null }))} /></label>
              <label className="space-y-1 text-sm">{t("تاريخ آخر يوم عمل")}<Input type="date" value={edit.last_day} onChange={(e) => setEdit(recalc({ ...edit, last_day: e.target.value }))} /></label>
              <label className="space-y-1 text-sm">{t("الأجر الشهري (أساسي + بدلات)")}<Input type="number" value={edit.wage} onChange={(e) => setEdit(recalc({ ...edit, wage: Number(e.target.value) }))} /></label>
              <label className="space-y-1 text-sm">{t("رصيد الإجازات (أيام)")}<Input type="number" value={edit.leave_days} onChange={(e) => setEdit(recalc({ ...edit, leave_days: Number(e.target.value) }))} /></label>
              <label className="space-y-1 text-sm">{t("مستحقات أخرى")}<Input type="number" value={edit.other_dues} onChange={(e) => setEdit(recalc({ ...edit, other_dues: Number(e.target.value) }))} /></label>
              <label className="space-y-1 text-sm">{t("الخصومات")}<Input type="number" value={edit.deductions} onChange={(e) => setEdit(recalc({ ...edit, deductions: Number(e.target.value) }))} /></label>
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/50 p-3 text-sm sm:col-span-2">
                <span>{t("مدة الخدمة")}</span><b>{serviceYears(edit.joined, edit.last_day).toFixed(2)} {t("سنة")}</b>
                <span>{t("مكافأة نهاية الخدمة")}</span><b>{fmt(edit.eos)}</b>
                <span>{t("بدل الإجازات")}</span><b>{fmt(edit.leave_pay)}</b>
                <span className="font-bold">{t("المستحقات الصافية")}</span><b className="text-primary">{fmt(edit.net)}</b>
              </div>
              <label className="space-y-1 text-sm sm:col-span-2">{t("ملاحظات")}<Textarea value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></label>
              {canEdit && (
                <div className="flex gap-2 sm:col-span-2">
                  <Button onClick={save}>{t("حفظ")}</Button>
                  {edit.id && <Button variant="destructive" onClick={() => remove(edit.id!)}><Trash2 /> {t("حذف")}</Button>}
                </div>
              )}
            </fieldset>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
