import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Eye, Pencil, Plus, Search, Star } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useCanEditHr } from "@/lib/permissions";
import { t, useLanguage } from "@/lib/i18n";
import { CRITERIA, QUARTERS, REVIEW_STATUSES, grade, isLate, quarterOf, totalScore } from "@/lib/performance";

export const Route = createFileRoute("/performance")({
  head: () => ({
    meta: [
      { title: "تقييم الأداء الربع سنوي — Metal Fuze" },
      { name: "description", content: "سجل تقييمات الأداء الربع سنوية لجميع موظفي Metal Fuze." },
      { property: "og:title", content: "تقييم الأداء الربع سنوي — Metal Fuze" },
      { property: "og:description", content: "متابعة وتوثيق تقييمات أداء الموظفين كل ربع سنة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PerformancePage,
});

type Emp = { id: string; name: string; dept: string; active: boolean };
type Review = {
  id: string; employee_id: string; year: number; quarter: number; review_date: string | null; reviewer_name: string;
  scores: Record<string, number>; total: number; status: string; manager_notes: string; development_plan: string;
};
type Draft = Omit<Review, "id"> & { id?: string };

const now = new Date();
const today = () => now.toISOString().slice(0, 10);
const statusAr = (s: string) => REVIEW_STATUSES.find((x) => x.key === s)?.ar ?? s;
const statusCls: Record<string, string> = {
  not_started: "bg-muted text-muted-foreground", in_progress: "bg-accent text-accent-foreground",
  completed: "bg-primary/15 text-primary", approved: "bg-primary text-primary-foreground",
};

function PerformancePage() {
  useLanguage();
  const canEdit = useCanEditHr();
  const [emps, setEmps] = useState<Emp[]>([]);
  const [rows, setRows] = useState<Review[]>([]);
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("");
  const [year, setYear] = useState(now.getFullYear());
  const [quarter, setQuarter] = useState(0);
  const [edit, setEdit] = useState<Draft | null>(null);
  const [view, setView] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [e, r] = await Promise.all([
      supabase.from("employees").select("id,name,dept,active").order("id"),
      supabase.from("performance_reviews").select("*").order("year", { ascending: false }).order("quarter", { ascending: false }),
    ]);
    setEmps((e.data ?? []) as Emp[]);
    setRows((r.data ?? []) as unknown as Review[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  const empMap = useMemo(() => new Map(emps.map((e) => [e.id, e])), [emps]);
  const depts = useMemo(() => [...new Set(emps.map((e) => e.dept).filter(Boolean))], [emps]);
  const years = useMemo(() => [...new Set([now.getFullYear(), ...rows.map((r) => r.year)])].sort((a, b) => b - a), [rows]);

  const match = (empId: string) => {
    const e = empMap.get(empId);
    const s = q.trim().toLowerCase();
    return (!dept || e?.dept === dept) && (!s || e?.name.toLowerCase().includes(s) || empId.toLowerCase().includes(s));
  };
  const list = rows.filter((r) => r.year === year && (!quarter || r.quarter === quarter) && match(r.employee_id));

  // Report for a single quarter: every active employee, reviewed or missing.
  const rq = quarter || (year === now.getFullYear() ? quarterOf(now) : 4);
  const report = emps.filter((e) => e.active && match(e.id)).map((e) => {
    const r = rows.find((x) => x.employee_id === e.id && x.year === year && x.quarter === rq);
    return { e, r, late: isLate(year, rq, r?.status ?? null) };
  });
  const done = report.filter((x) => x.r && (x.r.status === "completed" || x.r.status === "approved")).length;
  const late = report.filter((x) => x.late).length;

  function openNew(empId = "") {
    setEdit({ employee_id: empId, year, quarter: rq, review_date: today(), reviewer_name: "", scores: {}, total: 0,
      status: "in_progress", manager_notes: "", development_plan: "" });
  }

  async function save(d: Draft) {
    if (!d.employee_id) return toast.error(t("اختر الموظف"));
    if (!d.reviewer_name.trim()) return toast.error(t("أدخل اسم المدير المقيّم"));
    if (!d.id && rows.some((r) => r.employee_id === d.employee_id && r.year === d.year && r.quarter === d.quarter))
      return toast.error(t("يوجد تقييم لهذا الموظف في نفس الربع والسنة"));
    const payload = { employee_id: d.employee_id, year: d.year, quarter: d.quarter, review_date: d.review_date || null,
      reviewer_name: d.reviewer_name.trim().slice(0, 120), scores: d.scores, total: totalScore(d.scores),
      status: d.status === "approved" ? "completed" : d.status, manager_notes: d.manager_notes.slice(0, 4000),
      development_plan: d.development_plan.slice(0, 4000), updated_at: new Date().toISOString() };
    const res = d.id ? await supabase.from("performance_reviews").update(payload).eq("id", d.id)
      : await supabase.from("performance_reviews").insert(payload);
    if (res.error) return toast.error(res.error.code === "23505" ? t("يوجد تقييم لهذا الموظف في نفس الربع والسنة") : t("تعذر الحفظ"));
    toast.success(t("تم حفظ التقييم")); setEdit(null); load(); return;
    setEdit(null); load();
  }

  async function approve(r: Review) {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("performance_reviews").update({ status: "approved", approved_by: u.user?.id ?? null, approved_at: new Date().toISOString() }).eq("id", r.id);
    if (error) return toast.error(t("تعذر الاعتماد"));
    toast.success(t("تم اعتماد التقييم")); load(); return;
  }

  const history = view ? rows.filter((r) => r.employee_id === view).sort((a, b) => a.year - b.year || a.quarter - b.quarter) : [];

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold"><Star className="text-primary" /> {t("سجل تقييمات الأداء الربع سنوي")}</h1>
          <p className="text-sm text-muted-foreground">{t("متابعة وتوثيق تقييمات أداء جميع الموظفين لكل ربع من العام")}</p>
        </div>
        {canEdit && <Button onClick={() => openNew()}><Plus /> {t("إضافة تقييم جديد")}</Button>}
      </div>

      <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-4">
        <div className="relative"><Search className="absolute start-2 top-2.5 size-4 text-muted-foreground" />
          <Input className="ps-8" placeholder={t("بحث باسم الموظف أو الرقم الوظيفي")} value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={dept} onChange={(e) => setDept(e.target.value)}>
          <option value="">{t("جميع الأقسام")}</option>{depts.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={quarter} onChange={(e) => setQuarter(Number(e.target.value))}>
          <option value={0}>{t("كل الأرباع")}</option>{QUARTERS.map((x) => <option key={x.q} value={x.q}>Q{x.q} — {t(x.ar)} ({t(x.months)})</option>)}
        </select>
        <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="text-muted-foreground"><tr className="border-b border-border text-start">
            {["الرقم الوظيفي", "اسم الموظف", "القسم", "الربع", "السنة", "تاريخ التقييم", "المدير المقيّم", "الدرجة النهائية", "التقدير", "الحالة", ""].map((h, i) => <th key={i} className="p-3 text-start">{h && t(h)}</th>)}
          </tr></thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={11} className="p-6 text-center text-muted-foreground">{t("لا توجد تقييمات")}</td></tr>}
            {list.map((r) => { const e = empMap.get(r.employee_id); return (
              <tr key={r.id} className="border-b border-border last:border-0">
                <td className="p-3" dir="ltr">{r.employee_id}</td><td className="p-3 font-medium">{e?.name}</td><td className="p-3">{e?.dept}</td>
                <td className="p-3">Q{r.quarter}</td><td className="p-3">{r.year}</td><td className="p-3">{r.review_date ?? "-"}</td>
                <td className="p-3">{r.reviewer_name}</td><td className="p-3 font-bold">{r.total}</td><td className="p-3">{t(grade(Number(r.total)))}</td>
                <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-xs ${statusCls[r.status]}`}>{t(statusAr(r.status))}</span></td>
                <td className="p-3"><div className="flex gap-1">
                  <Button size="icon" variant="ghost" title={t("السجل")} onClick={() => setView(r.employee_id)}><Eye /></Button>
                  {canEdit && r.status !== "approved" && <Button size="icon" variant="ghost" title={t("تعديل")} onClick={() => setEdit({ ...r })}><Pencil /></Button>}
                  {canEdit && r.status === "completed" && <Button size="icon" variant="ghost" title={t("اعتماد")} onClick={() => approve(r)}><CheckCircle2 /></Button>}
                </div></td>
              </tr>); })}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">{t("تقرير الربع")} Q{rq} {year}</h2>
          <div className="flex gap-3 text-sm">
            <span>{t("مكتمل")}: <b className="text-primary">{done}</b> / {report.length}</span>
            <span>{t("متأخر")}: <b className="text-destructive">{late}</b></span>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {report.map(({ e, r, late: l }) => (
            <div key={e.id} className={`flex items-center justify-between rounded-lg border p-2 text-sm ${l ? "border-destructive/50 bg-destructive/5" : "border-border"}`}>
              <span><b>{e.name}</b> <span className="text-xs text-muted-foreground" dir="ltr">#{e.id}</span></span>
              <span className="flex items-center gap-2">
                {r ? <span className={`rounded-full px-2 py-0.5 text-xs ${statusCls[r.status]}`}>{t(statusAr(r.status))} {r.total ? `· ${r.total}` : ""}</span>
                  : <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{t("لم يبدأ")}</span>}
                {l && <span className="text-xs text-destructive">{t("متأخر")}</span>}
                {!r && canEdit && <Button size="sm" variant="ghost" onClick={() => { setEdit(null); openNew(e.id); }}><Plus /></Button>}
              </span>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>{edit?.id ? t("تعديل التقييم") : t("إضافة تقييم جديد")}</DialogTitle></DialogHeader>
          {edit && <ReviewForm d={edit} emps={emps.filter((e) => e.active || e.id === edit.employee_id)} onChange={setEdit} onSave={() => save(edit)} onCancel={() => setEdit(null)} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>{t("سجل التقييمات")} — {view && empMap.get(view)?.name}</DialogTitle></DialogHeader>
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="text-muted-foreground"><tr className="border-b border-border">
              <th className="p-2 text-start">{t("الربع")}</th>{CRITERIA.map((c) => <th key={c.key} className="p-2 text-start text-xs">{t(c.ar)}</th>)}<th className="p-2 text-start">{t("الإجمالي")}</th><th className="p-2 text-start">{t("التغير")}</th>
            </tr></thead>
            <tbody>{history.map((r, i) => { const prev = history[i - 1]; const diff = prev ? Number(r.total) - Number(prev.total) : null; return (
              <tr key={r.id} className="border-b border-border align-top">
                <td className="p-2">Q{r.quarter} {r.year}<div className="text-xs text-muted-foreground">{t(statusAr(r.status))}</div></td>
                {CRITERIA.map((c) => <td key={c.key} className="p-2">{r.scores?.[c.key] ?? 0}/{c.max}</td>)}
                <td className="p-2 font-bold">{r.total}</td>
                <td className={`p-2 ${diff == null ? "" : diff >= 0 ? "text-primary" : "text-destructive"}`} dir="ltr">{diff == null ? "-" : diff >= 0 ? `+${diff}` : diff}</td>
              </tr>); })}</tbody>
          </table></div>
          {history.map((r) => (r.manager_notes || r.development_plan) && (
            <div key={r.id} className="rounded-lg border border-border p-2 text-sm">
              <b>Q{r.quarter} {r.year}</b>
              {r.manager_notes && <p><span className="text-muted-foreground">{t("ملاحظات المدير")}: </span>{r.manager_notes}</p>}
              {r.development_plan && <p><span className="text-muted-foreground">{t("خطة التطوير للربع القادم")}: </span>{r.development_plan}</p>}
            </div>
          ))}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReviewForm({ d, emps, onChange, onSave, onCancel }: { d: Draft; emps: Emp[]; onChange: (d: Draft) => void; onSave: () => void; onCancel: () => void }) {
  const total = totalScore(d.scores);
  const sel = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">{t("الموظف")} *
          <select className={sel} value={d.employee_id} disabled={!!d.id} onChange={(e) => onChange({ ...d, employee_id: e.target.value })}>
            <option value="">{t("اختر الموظف")}</option>{emps.map((e) => <option key={e.id} value={e.id}>{e.id} — {e.name}</option>)}
          </select></label>
        <label className="text-sm">{t("المدير المقيّم")} *<Input value={d.reviewer_name} onChange={(e) => onChange({ ...d, reviewer_name: e.target.value })} /></label>
        <label className="text-sm">{t("الربع")} *
          <select className={sel} value={d.quarter} disabled={!!d.id} onChange={(e) => onChange({ ...d, quarter: Number(e.target.value) })}>
            {QUARTERS.map((x) => <option key={x.q} value={x.q}>{t(x.ar)} ({t(x.months)})</option>)}
          </select></label>
        <label className="text-sm">{t("السنة")} *<Input type="number" value={d.year} disabled={!!d.id} onChange={(e) => onChange({ ...d, year: Number(e.target.value) })} /></label>
        <label className="text-sm">{t("تاريخ التقييم")}<Input type="date" value={d.review_date ?? ""} onChange={(e) => onChange({ ...d, review_date: e.target.value })} /></label>
        <label className="text-sm">{t("الحالة")}
          <select className={sel} value={d.status} onChange={(e) => onChange({ ...d, status: e.target.value })}>
            {REVIEW_STATUSES.filter((s) => s.key !== "approved").map((s) => <option key={s.key} value={s.key}>{t(s.ar)}</option>)}
          </select></label>
      </div>
      <table className="w-full text-sm">
        <thead className="text-muted-foreground"><tr className="border-b border-border"><th className="p-2 text-start">{t("المعيار")}</th><th className="p-2 text-start">{t("الدرجة")}</th><th className="p-2 text-start">{t("الدرجة الممنوحة")}</th></tr></thead>
        <tbody>{CRITERIA.map((c) => (
          <tr key={c.key} className="border-b border-border"><td className="p-2">{t(c.ar)}</td><td className="p-2">{c.max}</td>
            <td className="p-2"><Input type="number" min={0} max={c.max} className="w-24" value={d.scores[c.key] ?? ""}
              onChange={(e) => onChange({ ...d, scores: { ...d.scores, [c.key]: Math.min(c.max, Math.max(0, Number(e.target.value))) } })} /></td></tr>
        ))}
          <tr className="font-bold"><td className="p-2">{t("الإجمالي")}</td><td className="p-2">100</td><td className="p-2">{total} — {t(grade(total))}</td></tr>
        </tbody>
      </table>
      <label className="block text-sm">{t("ملاحظات المدير")}<Textarea value={d.manager_notes} onChange={(e) => onChange({ ...d, manager_notes: e.target.value })} /></label>
      <label className="block text-sm">{t("خطة التطوير للربع القادم")}<Textarea value={d.development_plan} onChange={(e) => onChange({ ...d, development_plan: e.target.value })} /></label>
      <div className="flex justify-end gap-2"><Button variant="outline" onClick={onCancel}>{t("إلغاء")}</Button><Button onClick={onSave}>{t("حفظ")}</Button></div>
    </div>
  );
}
