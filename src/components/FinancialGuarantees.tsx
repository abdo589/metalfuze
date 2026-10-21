import { useEffect, useState } from "react";
import { Eye, Landmark, LoaderCircle, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { extractBond } from "@/lib/doc-extract.functions";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { t, useLanguage, locale } from "@/lib/i18n";
import { useRole } from "@/lib/permissions";
import { fmtMoney } from "@/lib/projects";
import type { Database } from "@/integrations/supabase/types";

type Row = Database["public"]["Tables"]["financial_guarantees"]["Row"];
const BUCKET = "dashboard-project-files";
export const BOND_KINDS = ["ضمان ابتدائي", "ضمان نهائي", "ضمان دفعة مقدمة", "سند لأمر"];
export const BOND_STATUSES = ["قائم", "ملغى", "منفّذ"];

const blank = (projectId: string) => ({ project_id: projectId, kind: "", bond_no: "", amount: 0, creditor: "", debtor: "", purpose: "", issue_date: null as string | null, return_condition: "", status: "قائم" });

/** Financial bonds (bank guarantees, promissory notes) linked to one project. */
export function FinancialGuarantees({ projectId, delivered }: { projectId: string; delivered: boolean }) {
  useLanguage();
  const role = useRole();
  const canEdit = role === "admin" || role === "accountant";
  const [rows, setRows] = useState<Row[]>([]);
  const [edit, setEdit] = useState<(ReturnType<typeof blank> & { id?: string }) | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const readBond = useServerFn(extractBond);

  async function uploadAndRead(f: File) {
    if (f.size > 10 * 1024 * 1024) { toast.error(t("الملف أكبر من 10 ميجا")); return; }
    setReading(true);
    try {
      const base64 = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1] ?? ""); r.onerror = rej; r.readAsDataURL(f); });
      const out = await readBond({ data: { base64, mediaType: f.type || "application/pdf", name: f.name, kinds: BOND_KINDS } });
      const b = blank(projectId);
      if (out.ok) {
        const x = out.fields;
        setEdit({ ...b, kind: BOND_KINDS.includes(x.kind) ? x.kind : b.kind, bond_no: x.bond_no, amount: x.amount, creditor: x.creditor, debtor: x.debtor, purpose: x.purpose, issue_date: x.issue_date || null, return_condition: x.return_condition });
        toast.success(t("تم استخراج البيانات — راجعها ثم احفظ"));
      } else { setEdit(b); toast.error(t("تعذر قراءة الملف، أكمل البيانات يدويًا")); }
      setFile(f);
    } catch { toast.error(t("تعذر قراءة الملف، أكمل البيانات يدويًا")); }
    finally { setReading(false); }
  }

  const load = () => supabase.from("financial_guarantees").select("*").eq("project_id", projectId).order("created_at").then(({ data }) => setRows(data ?? []));
  useEffect(() => { load(); }, [projectId]);

  async function save() {
    if (!edit) return;
    setBusy(true);
    try {
      let extra: { file_path?: string; file_name?: string } = {};
      if (file) {
        const path = `guarantees/${projectId}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, file);
        if (error) throw error;
        extra = { file_path: path, file_name: file.name };
      }
      const { id, ...data } = edit;
      const { error } = id
        ? await supabase.from("financial_guarantees").update({ ...data, ...extra }).eq("id", id)
        : await supabase.from("financial_guarantees").insert({ ...data, ...extra });
      if (error) throw error;
      setEdit(null); setFile(null); load();
      toast.success(t("تم الحفظ"));
    } catch { toast.error(t("تعذر الحفظ، حاول مرة أخرى")); }
    finally { setBusy(false); }
  }

  async function remove(r: Row) {
    if (!confirm(t("حذف السند؟"))) return;
    if (r.file_path) await supabase.storage.from(BUCKET).remove([r.file_path]);
    await supabase.from("financial_guarantees").delete().eq("id", r.id);
    load();
  }

  async function view(r: Row) {
    if (!r.file_path) return;
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(r.file_path, 60);
    if (data) window.open(data.signedUrl, "_blank");
  }

  const open = rows.filter((r) => r.status === "قائم");
  const field = (k: "bond_no" | "creditor" | "debtor" | "purpose" | "return_condition", label: string) => (
    <div className="space-y-1.5"><Label>{label}</Label>
      <Input value={edit?.[k] ?? ""} onChange={(e) => setEdit((x) => x && { ...x, [k]: e.target.value })} /></div>
  );
  const pick = (k: "kind" | "status", label: string, opts: string[]) => (
    <div className="space-y-1.5"><Label>{label}</Label>
      <Select value={edit?.[k] ?? ""} onValueChange={(v) => setEdit((x) => x && { ...x, [k]: v })}>
        <SelectTrigger><SelectValue placeholder={label} /></SelectTrigger>
        <SelectContent>{opts.map((o) => <SelectItem key={o} value={o}>{t(o)}</SelectItem>)}</SelectContent>
      </Select></div>
  );

  return (
    <div className="space-y-2 rounded-lg border border-border p-3 sm:col-span-2">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-display font-bold"><Landmark className="size-4" /> {t("الضمانات المالية")} ({rows.length})</h3>
        {canEdit && <div className="flex gap-1">
          <Button size="sm" variant="outline" disabled={reading} asChild>
            <label className="cursor-pointer">{reading ? <LoaderCircle className="animate-spin" /> : <Upload />} {reading ? t("جارٍ قراءة الملف...") : t("رفع سند واستخراج البيانات")}
              <input type="file" hidden accept="image/*,application/pdf" disabled={reading} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) uploadAndRead(f); }} />
            </label>
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEdit(blank(projectId))}><Plus /> {t("إضافة سند")}</Button>
        </div>}
      </div>
      {delivered && open.length > 0 && (
        <p className="rounded-md bg-warning/15 p-2 text-sm font-medium text-warning">{t("تم التسليم النهائي — طالبوا بإلغاء السند")} ({open.length})</p>
      )}
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">{t("لا توجد سندات مرتبطة بهذا المشروع")}</p> : rows.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-md bg-muted/40 p-2 text-sm">
          <b>{t(r.kind) || "—"}</b><span dir="ltr">{r.bond_no}</span>
          <span className="tabular-nums">{fmtMoney(Number(r.amount))} {t("ريال")}</span>
          <Badge variant="outline" className={r.status === "قائم" ? "text-info" : r.status === "منفّذ" ? "text-destructive" : "text-success"}>{t(r.status)}</Badge>
          <span className="text-xs text-muted-foreground">{r.creditor && `${t("الدائن")}: ${r.creditor}`} {r.debtor && `· ${t("المدين")}: ${r.debtor}`} {r.issue_date && `· ${r.issue_date}`}</span>
          {r.purpose && <span className="w-full text-xs">{t("الغرض")}: {r.purpose}</span>}
          {r.return_condition && <span className="w-full text-xs">{t("شرط الإرجاع")}: {r.return_condition}</span>}
          <div className="ms-auto flex gap-1">
            {r.file_path && <Button size="icon" variant="ghost" title={t("عرض")} onClick={() => view(r)}><Eye /></Button>}
            {canEdit && <Button size="icon" variant="ghost" onClick={() => setEdit({ ...r, amount: Number(r.amount) })}><Pencil /></Button>}
            {canEdit && <Button size="icon" variant="ghost" onClick={() => remove(r)}><Trash2 /></Button>}
          </div>
        </div>
      ))}
      <Dialog open={!!edit} onOpenChange={(o) => { if (!o) { setEdit(null); setFile(null); } }}>
        <DialogContent dir={locale() === "en-GB" ? "ltr" : "rtl"} className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader><DialogTitle>{edit?.id ? t("تعديل سند") : t("إضافة سند")}</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {pick("kind", t("النوع"), BOND_KINDS)}
            {field("bond_no", t("رقم السند"))}
            <div className="space-y-1.5"><Label>{t("المبلغ")}</Label>
              <Input inputMode="decimal" dir="ltr" placeholder="0" value={edit?.amount || ""} onChange={(e) => setEdit((x) => x && { ...x, amount: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 })} /></div>
            <div className="space-y-1.5"><Label>{t("تاريخ الإصدار")}</Label>
              <Input type="date" dir="ltr" value={edit?.issue_date ?? ""} onChange={(e) => setEdit((x) => x && { ...x, issue_date: e.target.value || null })} /></div>
            {field("creditor", t("الدائن"))}
            {field("debtor", t("المدين"))}
            {field("purpose", t("الغرض"))}
            {field("return_condition", t("شرط الإرجاع"))}
            {pick("status", t("الحالة"), BOND_STATUSES)}
            <div className="space-y-1.5"><Label>{t("المرفق")}</Label>
              <Input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
          </div>
          <DialogFooter><Button disabled={busy} onClick={save}>{t("حفظ")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
