import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, Plus, RotateCcw, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  CODES, DISCIPLINES, SUB_STATUSES, SUB_TYPES, OVERDUE_DAYS, canResubmit, codeClass, latestRevisions, pick, waitingDays,
  type CpAttachment, type CpSubmission,
} from "@/lib/cp";
import { useLanguage } from "@/lib/i18n";
import { Fld } from "./CpOverview";

export function CodeBadge({ code }: { code: string | null }) {
  const lang = useLanguage();
  if (!code) return <span className="text-muted-foreground">—</span>;
  return <span title={pick(CODES, code, lang)} className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-bold ${codeClass[code] ?? ""}`}>{code}<span className="hidden font-normal sm:inline">· {pick(CODES, code, lang)}</span></span>;
}

export const subKey = (projectId: string) => ["cp", "subs", projectId] as const;

type Draft = Partial<CpSubmission> & { title: string; type: string };

export function CpSubmissionsTab({ projectId, types }: { projectId: string; types: string[] }) {
  const lang = useLanguage();
  const qc = useQueryClient();
  const { data: all = [] } = useQuery({
    queryKey: subKey(projectId),
    queryFn: async () => {
      const { data, error } = await supabase.from("submissions").select("*").eq("project_id", projectId).order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const [fStatus, setFStatus] = useState("all");
  const [fCode, setFCode] = useState("all");
  const [fType, setFType] = useState("all");
  const [open, setOpen] = useState<Draft | null>(null);
  const rows = useMemo(() => latestRevisions(all.filter((s) => types.includes(s.type)))
    .filter((s) => (fStatus === "all" || s.status === fStatus) && (fCode === "all" || (fCode === "none" ? !s.code : s.code === fCode)) && (fType === "all" || s.type === fType))
    .sort((a, b) => a.ref_no.localeCompare(b.ref_no)), [all, types, fStatus, fCode, fType]);
  const history = (s: Partial<CpSubmission>) => {
    const root = s.parent_id ?? s.id;
    return all.filter((r) => r.id === root || r.parent_id === root).sort((a, b) => a.revision - b.revision);
  };
  const refresh = () => qc.invalidateQueries({ queryKey: ["cp"] });

  const resubmit = async (s: CpSubmission) => {
    const { data, error } = await supabase.from("submissions").insert({
      project_id: s.project_id, type: s.type, parent_id: s.parent_id ?? s.id, title: s.title, discipline: s.discipline, status: "draft",
    }).select("*").single();
    if (error) { toast.error("تعذر إعادة التقديم: " + error.message); return; }
    toast.success(`تم إنشاء Rev ${data.revision}`);
    await refresh();
    setOpen(data);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {types.length > 1 && (
          <Select value={fType} onValueChange={setFType}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">كل الأنواع</SelectItem>{SUB_TYPES.filter((t) => types.includes(t.v)).map((t) => <SelectItem key={t.v} value={t.v}>{lang === "en" ? t.en : t.ar}</SelectItem>)}</SelectContent>
          </Select>
        )}
        <Select value={fStatus} onValueChange={setFStatus}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">كل الحالات</SelectItem>{SUB_STATUSES.map((t) => <SelectItem key={t.v} value={t.v}>{lang === "en" ? t.en : t.ar}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={fCode} onValueChange={setFCode}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">كل الأكواد</SelectItem><SelectItem value="none">بدون كود</SelectItem>{CODES.map((c) => <SelectItem key={c.v} value={c.v}>{c.v} · {lang === "en" ? c.en : c.ar}</SelectItem>)}</SelectContent>
        </Select>
        <Button className="ms-auto" onClick={() => setOpen({ title: "", type: types[0]!, discipline: "civil", status: "draft" })}><Plus className="h-4 w-4" /> مستند جديد</Button>
      </div>
      <Card><CardContent className="overflow-x-auto p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>الرقم المرجعي</TableHead><TableHead>العنوان</TableHead><TableHead>النوع</TableHead><TableHead>التخصص</TableHead><TableHead>المراجعة</TableHead>
            <TableHead>تاريخ التقديم</TableHead><TableHead>الحالة</TableHead><TableHead>الكود</TableHead><TableHead>أيام الانتظار</TableHead><TableHead />
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((s) => {
              const w = waitingDays(s);
              return (
                <TableRow key={s.id} className="cursor-pointer" onClick={() => setOpen(s)}>
                  <TableCell dir="ltr" className="whitespace-nowrap text-start font-mono text-xs">{s.ref_no}</TableCell>
                  <TableCell className="min-w-48 font-medium">{s.title}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs">{pick(SUB_TYPES, s.type, "en")}</TableCell>
                  <TableCell>{pick(DISCIPLINES, s.discipline, lang)}</TableCell>
                  <TableCell dir="ltr" className="text-start">Rev {s.revision}</TableCell>
                  <TableCell className="whitespace-nowrap">{s.submitted_date ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap">{pick(SUB_STATUSES, s.status, lang)}</TableCell>
                  <TableCell><CodeBadge code={s.code} /></TableCell>
                  <TableCell>{w === null ? "—" : <span className={w > OVERDUE_DAYS ? "rounded bg-destructive/15 px-2 py-0.5 font-bold text-destructive" : ""}>{w}</span>}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {canResubmit(s) && <Button size="sm" variant="outline" onClick={() => resubmit(s)}><RotateCcw className="h-4 w-4" /> إعادة تقديم</Button>}
                  </TableCell>
                </TableRow>
              );
            })}
            {rows.length === 0 && <TableRow><TableCell colSpan={10} className="py-8 text-center text-muted-foreground">لا توجد مستندات</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>
      {open && <SubmissionDialog key={open.id ?? "new"} projectId={projectId} types={types} initial={open} history={open.id ? history(open) : []}
        onClose={() => setOpen(null)} onSaved={refresh} onResubmit={resubmit} onOpenRev={(r) => setOpen(r)} />}
    </div>
  );
}

function SubmissionDialog({ projectId, types, initial, history, onClose, onSaved, onResubmit, onOpenRev }: {
  projectId: string; types: string[]; initial: Draft; history: CpSubmission[];
  onClose: () => void; onSaved: () => Promise<unknown> | void; onResubmit: (s: CpSubmission) => void; onOpenRev: (s: CpSubmission) => void;
}) {
  const lang = useLanguage();
  const [f, setF] = useState<Draft>(initial);
  const [busy, setBusy] = useState(false);
  const atts = (f.attachments as CpAttachment[] | undefined) ?? [];
  const isLatest = !history.length || history[history.length - 1]!.id === f.id;

  const save = async () => {
    if (!f.title.trim()) { toast.error("العنوان مطلوب"); return; }
    setBusy(true);
    const row = {
      title: f.title.trim(), discipline: f.discipline ?? "civil", status: f.status ?? "draft", code: f.code ?? null,
      submitted_date: f.submitted_date || null, reply_date: f.reply_date || null, consultant_notes: f.consultant_notes ?? "", attachments: atts,
    };
    const res = f.id
      ? await supabase.from("submissions").update(row).eq("id", f.id).select("*").single()
      : await supabase.from("submissions").insert({ ...row, project_id: projectId, type: f.type }).select("*").single();
    setBusy(false);
    if (res.error) { toast.error("تعذر الحفظ: " + res.error.message); return; }
    toast.success(f.id ? "تم الحفظ" : `تم إنشاء ${res.data.ref_no}`);
    await onSaved();
    onClose();
  };
  const upload = async (file: File) => {
    setBusy(true);
    const path = `${projectId}/submissions/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
    const { error } = await supabase.storage.from("contract-files").upload(path, file);
    setBusy(false);
    if (error) { toast.error("تعذر الرفع: " + error.message); return; }
    setF({ ...f, attachments: [...atts, { path, name: file.name }] });
    toast.message("تم رفع الملف — اضغط حفظ");
  };
  const openFile = async (path: string) => {
    const { data, error } = await supabase.storage.from("contract-files").createSignedUrl(path, 10);
    if (error || !data) { toast.error("تعذر فتح الملف"); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{f.id ? <span dir="ltr">{f.ref_no} · Rev {f.revision}</span> : "مستند جديد"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Fld l="العنوان"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Fld></div>
          <Fld l="النوع">
            <Select value={f.type} onValueChange={(v) => setF({ ...f, type: v })} disabled={!!f.id}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{SUB_TYPES.filter((t) => types.includes(t.v)).map((t) => <SelectItem key={t.v} value={t.v}>{lang === "en" ? t.en : t.ar}</SelectItem>)}</SelectContent>
            </Select>
          </Fld>
          <Fld l="التخصص">
            <Select value={f.discipline ?? "civil"} onValueChange={(v) => setF({ ...f, discipline: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{DISCIPLINES.map((t) => <SelectItem key={t.v} value={t.v}>{lang === "en" ? t.en : t.ar}</SelectItem>)}</SelectContent>
            </Select>
          </Fld>
          <Fld l="تاريخ التقديم"><Input type="date" value={f.submitted_date ?? ""} onChange={(e) => setF({ ...f, submitted_date: e.target.value })} /></Fld>
          <Fld l="تاريخ الرد"><Input type="date" value={f.reply_date ?? ""} onChange={(e) => setF({ ...f, reply_date: e.target.value })} /></Fld>
          <Fld l="الحالة">
            <Select value={f.status ?? "draft"} onValueChange={(v) => setF({ ...f, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{SUB_STATUSES.map((t) => <SelectItem key={t.v} value={t.v}>{lang === "en" ? t.en : t.ar}</SelectItem>)}</SelectContent>
            </Select>
          </Fld>
          <Fld l="كود الاعتماد">
            <Select value={f.code ?? "none"} onValueChange={(v) => setF({ ...f, code: v === "none" ? null : v, status: v === "none" ? (f.status ?? "draft") : "replied" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="none">— بدون —</SelectItem>{CODES.map((c) => <SelectItem key={c.v} value={c.v}>{c.v} · {lang === "en" ? c.en : c.ar}</SelectItem>)}</SelectContent>
            </Select>
          </Fld>
          <div className="sm:col-span-2"><Fld l="ملاحظات الاستشاري"><Textarea value={f.consultant_notes ?? ""} onChange={(e) => setF({ ...f, consultant_notes: e.target.value })} /></Fld></div>
          <div className="space-y-2 sm:col-span-2">
            <div className="text-sm font-medium">المرفقات</div>
            {atts.map((a) => <Button key={a.path} variant="outline" size="sm" className="me-2" onClick={() => openFile(a.path)}><FileText className="h-4 w-4" /> {a.name}</Button>)}
            <label className="flex w-max cursor-pointer items-center gap-1 rounded-md bg-secondary px-3 py-1.5 text-sm text-secondary-foreground hover:bg-secondary/80">
              <Upload className="h-4 w-4" /> رفع مرفق
              <input type="file" className="hidden" disabled={busy} onChange={(e) => { const file = e.target.files?.[0]; if (file) upload(file); e.target.value = ""; }} />
            </label>
          </div>
          {f.created_by_name && <div className="text-xs text-muted-foreground sm:col-span-2">أنشأه: {f.created_by_name}</div>}
        </div>
        {history.length > 0 && (
          <div className="space-y-2 border-t border-border pt-3">
            <div className="text-sm font-semibold">سجل المراجعات</div>
            <ul className="space-y-1">
              {history.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => onOpenRev(r)} className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-start text-sm hover:bg-muted ${r.id === f.id ? "bg-muted" : ""}`}>
                    <span dir="ltr" className="font-mono">Rev {r.revision}</span>
                    <span className="text-xs text-muted-foreground">{r.submitted_date ?? "—"} → {r.reply_date ?? "—"}</span>
                    <CodeBadge code={r.code} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <DialogFooter className="gap-2">
          {f.id && isLatest && canResubmit({ code: f.code ?? null }) && <Button variant="outline" onClick={() => onResubmit(f as CpSubmission)}><RotateCcw className="h-4 w-4" /> إعادة تقديم</Button>}
          <Button onClick={save} disabled={busy}>حفظ</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
