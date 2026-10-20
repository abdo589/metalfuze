import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, FileText, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useCanEdit } from "@/lib/permissions";
import { t, useLanguage } from "@/lib/i18n";
import { ALERT_DAYS, daysLeft } from "@/lib/residency";
import { StatCard } from "@/components/ResidenciesPanel";
import { PdfButton } from "@/components/PdfButton";

export const Route = createFileRoute("/documents")({
  head: () => ({
    meta: [
      { title: "وثائق الشركة — Metal Fuze" },
      { name: "description", content: "متابعة وثائق وتراخيص شركة Metal Fuze وتواريخ انتهائها." },
      { property: "og:title", content: "وثائق الشركة — Metal Fuze" },
      { property: "og:description", content: "تتبع السجل التجاري والشهادات والتراخيص وتنبيهات الانتهاء." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DocumentsPage,
});

type Doc = { id: string; doc_type: string; doc_number: string; branch: string; issue_date: string | null; expiry_date: string | null; notes: string };
type Draft = Omit<Doc, "id"> & { id?: string };

const DOC_TYPES = ["سجل تجاري", "رخصة بلدية", "عقد إيجار", "شهادة المحتوى المحلي", "شهادة هيئة الزكاة والضريبة والجمارك", "شهادة تصنيف",
  "تأمين صحي للموظفين", "تأمين سيارات", "منشآت", "غرفة الرياض", "شهادة تسجيل في ضريبة القيمة المضافة", "الهيئة السعودية للمقاولين", "شهادة الأيزو"];
const BRANCHES = ["الرياض", "جدة", "الدمام", "الجبيل", "الظهران", "الخبر", "الطائف", "جازان", "أبها", "محايل عسير", "خميس مشيط", "نجران", "تبوك", "الباحة"];

function statusOf(d: number | null) {
  if (d === null) return { key: "unset", label: "غير محدد", cls: "bg-muted text-muted-foreground" };
  if (d < 0) return { key: "expired", label: "منتهية", cls: "bg-destructive/15 text-destructive" };
  if (d <= ALERT_DAYS) return { key: "soon", label: "قرب الانتهاء", cls: "bg-warning/15 text-warning" };
  return { key: "valid", label: "سارية", cls: "bg-success/15 text-success" };
}

function DocumentsPage() {
  useLanguage();
  const canEdit = useCanEdit();
  const [rows, setRows] = useState<Doc[]>([]);
  const [q, setQ] = useState("");
  const [branch, setBranch] = useState("");
  const [st, setSt] = useState("");
  const [edit, setEdit] = useState<Draft | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("company_documents").select("*").order("expiry_date", { ascending: true, nullsFirst: false });
    setRows((data ?? []) as Doc[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  const list = useMemo(() => rows.map((r) => ({ ...r, days: r.expiry_date ? daysLeft(r.expiry_date) : null }))
    .map((r) => ({ ...r, s: statusOf(r.days) }))
    .filter((r) => (!q || `${r.doc_type} ${r.doc_number} ${r.notes}`.includes(q)) && (!branch || r.branch === branch) && (!st || r.s.key === st))
    .sort((a, b) => (a.days ?? 99999) - (b.days ?? 99999)), [rows, q, branch, st]);
  const all = rows.map((r) => statusOf(r.expiry_date ? daysLeft(r.expiry_date) : null).key);

  async function save() {
    if (!edit || !edit.doc_type.trim()) { toast.error(t("اختر نوع الوثيقة")); return; }
    const { id, ...body } = edit;
    const payload = { ...body, issue_date: body.issue_date || null, expiry_date: body.expiry_date || null };
    const { error } = id ? await supabase.from("company_documents").update(payload).eq("id", id)
      : await supabase.from("company_documents").insert(payload);
    if (error) { toast.error(t("تعذر الحفظ")); return; }
    toast.success(t("تم الحفظ")); setEdit(null); load();
  }
  async function remove(id: string) {
    if (!confirm(t("حذف هذه الوثيقة نهائيًا؟"))) return;
    const { error } = await supabase.from("company_documents").delete().eq("id", id);
    if (error) { toast.error(t("تعذر الحذف")); return; }
    load();
  }

  return (
    <main className="mx-auto max-w-7xl space-y-5 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><FileText className="size-6 text-primary" /> {t("وثائق الشركة")}</h1>
          <p className="text-sm text-muted-foreground">{t("السجلات والشهادات والتراخيص وتواريخ انتهائها")}</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <PdfButton />
          {canEdit && <Button onClick={() => setEdit({ doc_type: DOC_TYPES[0]!, doc_number: "", branch: "الرياض", issue_date: "", expiry_date: "", notes: "" })}><Plus /> {t("إضافة وثيقة")}</Button>}
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label={t("إجمالي الوثائق")} value={rows.length} icon={<FileText className="size-5 text-primary" />} cls="border-border bg-card" />
        <StatCard label={t("قرب الانتهاء")} value={all.filter((k) => k === "soon").length} icon={<CalendarClock className="size-5 text-warning" />} cls="border-warning/40 bg-warning/10" />
        <StatCard label={t("منتهية")} value={all.filter((k) => k === "expired").length} icon={<AlertTriangle className="size-5 text-destructive" />} cls="border-destructive/40 bg-destructive/10" />
        <StatCard label={t("سارية")} value={all.filter((k) => k === "valid").length} icon={<CheckCircle2 className="size-5 text-success" />} cls="border-success/40 bg-success/10" />
      </section>

      <div className="flex flex-wrap gap-2 print:hidden">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute start-2 top-2.5 size-4 text-muted-foreground" />
          <Input className="ps-8" placeholder={t("بحث بنوع أو رقم الوثيقة")} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="h-9 rounded-md border bg-background px-2 text-sm" value={branch} onChange={(e) => setBranch(e.target.value)}>
          <option value="">{t("كل الفروع")}</option>
          {BRANCHES.map((b) => <option key={b} value={b}>{t(b)}</option>)}
        </select>
        <select className="h-9 rounded-md border bg-background px-2 text-sm" value={st} onChange={(e) => setSt(e.target.value)}>
          <option value="">{t("كل الحالات")}</option>
          <option value="expired">{t("منتهية")}</option>
          <option value="soon">{t("قرب الانتهاء")}</option>
          <option value="valid">{t("سارية")}</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-start">
            <tr>{["م", "نوع الوثيقة", "رقم الوثيقة", "الفرع", "تاريخ الإصدار", "تاريخ الانتهاء", "الأيام المتبقية", "الحالة", "ملاحظات"].map((h) =>
              <th key={h} className="p-2 text-start font-semibold">{t(h)}</th>)}
              {canEdit && <th className="p-2 print:hidden" />}
            </tr>
          </thead>
          <tbody>
            {list.map((r, i) => (
              <tr key={r.id} className="border-t">
                <td className="p-2">{i + 1}</td>
                <td className="p-2 font-medium">{t(r.doc_type)}</td>
                <td className="p-2 tabular-nums" dir="ltr">{r.doc_number || "—"}</td>
                <td className="p-2">{t(r.branch)}</td>
                <td className="p-2 tabular-nums">{r.issue_date ?? "—"}</td>
                <td className="p-2 tabular-nums">{r.expiry_date ?? "—"}</td>
                <td className="p-2 tabular-nums">{r.days === null ? "—" : r.days}</td>
                <td className="p-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.s.cls}`}>{t(r.s.label)}</span></td>
                <td className="p-2 text-muted-foreground">{r.notes || "—"}</td>
                {canEdit && <td className="p-2 print:hidden"><div className="flex gap-1">
                  <Button size="icon" variant="ghost" aria-label={t("تعديل")} onClick={() => setEdit({ ...r, issue_date: r.issue_date ?? "", expiry_date: r.expiry_date ?? "" })}><Pencil /></Button>
                  <Button size="icon" variant="ghost" className="text-destructive" aria-label={t("حذف")} onClick={() => remove(r.id)}><Trash2 /></Button>
                </div></td>}
              </tr>
            ))}
            {!list.length && <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">{t("لا توجد وثائق")}</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit?.id ? t("تعديل وثيقة") : t("إضافة وثيقة")}</DialogTitle></DialogHeader>
          {edit && <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm sm:col-span-2">{t("نوع الوثيقة")}
              <Input list="doc-types" value={edit.doc_type} onChange={(e) => setEdit({ ...edit, doc_type: e.target.value })} />
              <datalist id="doc-types">{DOC_TYPES.map((d) => <option key={d} value={d} />)}</datalist>
            </label>
            <label className="grid gap-1 text-sm">{t("رقم الوثيقة")}<Input value={edit.doc_number} onChange={(e) => setEdit({ ...edit, doc_number: e.target.value })} /></label>
            <label className="grid gap-1 text-sm">{t("الفرع")}
              <select className="h-9 rounded-md border bg-background px-2" value={edit.branch} onChange={(e) => setEdit({ ...edit, branch: e.target.value })}>
                {BRANCHES.map((b) => <option key={b} value={b}>{t(b)}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm">{t("تاريخ الإصدار")}<Input type="date" value={edit.issue_date ?? ""} onChange={(e) => setEdit({ ...edit, issue_date: e.target.value })} /></label>
            <label className="grid gap-1 text-sm">{t("تاريخ الانتهاء")}<Input type="date" value={edit.expiry_date ?? ""} onChange={(e) => setEdit({ ...edit, expiry_date: e.target.value })} /></label>
            <label className="grid gap-1 text-sm sm:col-span-2">{t("ملاحظات")}<Textarea value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></label>
            <Button className="sm:col-span-2" onClick={save}>{t("حفظ")}</Button>
          </div>}
        </DialogContent>
      </Dialog>
    </main>
  );
}
