import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, Plus, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  INV_STATUSES, cpKeys, invLate, invStatusClass, invoiceTotals, netOf, pick, sar, latestRevisions,
  type CpAttachment, type CpInvoice, type CpSubmission,
} from "@/lib/cp";
import { useLanguage } from "@/lib/i18n";
import { Fld } from "./CpOverview";
import { CodeBadge, subKey } from "./CpSubmissionsTab";

const invKey = (p: string) => ["cp", "invoices", p] as const;
type Draft = Partial<CpInvoice>;

export function CpInvoicesTab({ projectId }: { projectId: string }) {
  const lang = useLanguage();
  const qc = useQueryClient();
  const { data: list = [] } = useQuery({
    queryKey: invKey(projectId),
    queryFn: async () => {
      const { data, error } = await supabase.from("invoices").select("*").eq("project_id", projectId).order("invoice_no");
      if (error) throw error;
      return data;
    },
  });
  const { data: contract } = useQuery({
    queryKey: cpKeys.contract(projectId),
    queryFn: async () => {
      const { data, error } = await supabase.from("project_contracts").select("*").eq("project_id", projectId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const { data: subs = [] } = useQuery({
    queryKey: subKey(projectId),
    queryFn: async () => {
      const { data, error } = await supabase.from("submissions").select("*").eq("project_id", projectId).order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const wirs = useMemo(() => latestRevisions(subs.filter((s) => s.type === "WIR")), [subs]);
  const [fStatus, setFStatus] = useState("all");
  const [open, setOpen] = useState<Draft | null>(null);
  const t = invoiceTotals(Number(contract?.value ?? 0), list);
  const rows = list.filter((i) => fStatus === "all" || i.status === fStatus);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tot l="قيمة العقد" v={sar(t.contract, lang)} />
        <Tot l="إجمالي المستخلصات" v={sar(t.invoiced, lang)} />
        <Tot l="إجمالي المدفوع (صافي)" v={sar(t.paid, lang)} />
        <Tot l="المتبقي من العقد" v={sar(t.remaining, lang)} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={fStatus} onValueChange={setFStatus}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">كل الحالات</SelectItem>{INV_STATUSES.map((s) => <SelectItem key={s.v} value={s.v}>{lang === "en" ? s.en : s.ar}</SelectItem>)}</SelectContent>
        </Select>
        <Button className="ms-auto" onClick={() => setOpen({ status: "draft", retention_pct: 10, amount: 0, wir_ids: [] })}><Plus className="h-4 w-4" /> مستخلص جديد</Button>
      </div>
      <Card><CardContent className="overflow-x-auto p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>رقم المستخلص</TableHead><TableHead>الفترة</TableHead><TableHead>المبلغ</TableHead><TableHead>المحتجز</TableHead><TableHead>الصافي</TableHead>
            <TableHead>تاريخ التقديم</TableHead><TableHead>الحالة</TableHead><TableHead>تاريخ الصرف</TableHead><TableHead>WIRs</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((i) => (
              <TableRow key={i.id} className="cursor-pointer" onClick={() => setOpen(i)}>
                <TableCell className="font-bold">#{i.invoice_no}</TableCell>
                <TableCell className="whitespace-nowrap text-xs">{i.period_from ?? "—"} → {i.period_to ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap">{sar(Number(i.amount), lang)}</TableCell>
                <TableCell>{Number(i.retention_pct)}%</TableCell>
                <TableCell className="whitespace-nowrap font-medium">{sar(Number(i.net_amount ?? 0), lang)}</TableCell>
                <TableCell className="whitespace-nowrap">{i.submitted_date ?? "—"}</TableCell>
                <TableCell><span className={`rounded-full px-2.5 py-0.5 text-xs ${invStatusClass[i.status] ?? ""}`}>{pick(INV_STATUSES, i.status, lang)}</span>
                  {invLate(i) && <span className="ms-1 rounded bg-destructive/15 px-1.5 py-0.5 text-xs text-destructive">+30 يوم</span>}</TableCell>
                <TableCell className="whitespace-nowrap">{i.paid_date ?? "—"}</TableCell>
                <TableCell>{i.wir_ids.length}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={9} className="py-8 text-center text-muted-foreground">لا توجد مستخلصات</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>
      {open && <InvoiceDialog key={open.id ?? "new"} projectId={projectId} initial={open} wirs={wirs} onClose={() => setOpen(null)} onSaved={() => qc.invalidateQueries({ queryKey: ["cp"] })} />}
    </div>
  );
}

function Tot({ l, v }: { l: string; v: string }) {
  return <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">{l}</div><div className="text-lg font-bold text-foreground">{v}</div></CardContent></Card>;
}

function InvoiceDialog({ projectId, initial, wirs, onClose, onSaved }: { projectId: string; initial: Draft; wirs: CpSubmission[]; onClose: () => void; onSaved: () => Promise<unknown> }) {
  const lang = useLanguage();
  const [f, setF] = useState<Draft>(initial);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const atts = (f.attachments as CpAttachment[] | undefined) ?? [];
  const selected = new Set(f.wir_ids ?? []);
  const eligible = wirs.filter((w) => w.code === "A" || w.code === "B" || selected.has(w.id));
  const qc = useQueryClient();
  const notesQ = useQuery({
    queryKey: ["cp", "inv-notes", f.id ?? "new"],
    enabled: !!f.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("invoice_notes").select("*").eq("invoice_id", f.id!).order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const save = async () => {
    setBusy(true);
    const row = {
      period_from: f.period_from || null, period_to: f.period_to || null, wir_ids: f.wir_ids ?? [], amount: Number(f.amount) || 0,
      retention_pct: Number(f.retention_pct) || 0, submitted_date: f.submitted_date || null, status: f.status ?? "draft",
      paid_date: f.paid_date || null, notes: f.notes ?? "", attachments: atts,
    };
    const res = f.id
      ? await supabase.from("invoices").update(row).eq("id", f.id).select("*").single()
      : await supabase.from("invoices").insert({ ...row, project_id: projectId }).select("*").single();
    setBusy(false);
    if (res.error) { toast.error("تعذر الحفظ: " + res.error.message); return; }
    toast.success(f.id ? "تم الحفظ" : `تم إنشاء المستخلص #${res.data.invoice_no}`);
    await onSaved();
    onClose();
  };
  const addNote = async () => {
    if (!note.trim() || !f.id) return;
    const { error } = await supabase.from("invoice_notes").insert({ invoice_id: f.id, note: note.trim() });
    if (error) { toast.error("تعذر إضافة الملاحظة: " + error.message); return; }
    setNote("");
    qc.invalidateQueries({ queryKey: ["cp", "inv-notes", f.id] });
  };
  const upload = async (file: File) => {
    setBusy(true);
    const path = `${projectId}/invoices/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
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
  const toggle = (id: string, on: boolean) => setF({ ...f, wir_ids: on ? [...(f.wir_ids ?? []), id] : (f.wir_ids ?? []).filter((x) => x !== id) });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{f.id ? `المستخلص #${f.invoice_no}` : "مستخلص جديد"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Fld l="الفترة من"><Input type="date" value={f.period_from ?? ""} onChange={(e) => setF({ ...f, period_from: e.target.value })} /></Fld>
          <Fld l="الفترة إلى"><Input type="date" value={f.period_to ?? ""} onChange={(e) => setF({ ...f, period_to: e.target.value })} /></Fld>
          <Fld l="المبلغ (ر.س)"><Input type="number" inputMode="decimal" value={f.amount ?? 0} onChange={(e) => setF({ ...f, amount: Number(e.target.value) || 0 })} /></Fld>
          <Fld l="نسبة المحتجز (الضمان) %"><Input type="number" inputMode="decimal" value={f.retention_pct ?? 0} onChange={(e) => setF({ ...f, retention_pct: Number(e.target.value) || 0 })} /></Fld>
          <div className="rounded-md bg-muted p-3 sm:col-span-2"><span className="text-sm text-muted-foreground">المبلغ الصافي: </span><b>{sar(netOf(Number(f.amount) || 0, Number(f.retention_pct) || 0), lang)}</b></div>
          <Fld l="تاريخ التقديم"><Input type="date" value={f.submitted_date ?? ""} onChange={(e) => setF({ ...f, submitted_date: e.target.value })} /></Fld>
          <Fld l="الحالة">
            <Select value={f.status ?? "draft"} onValueChange={(v) => setF({ ...f, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{INV_STATUSES.map((s) => <SelectItem key={s.v} value={s.v}>{lang === "en" ? s.en : s.ar}</SelectItem>)}</SelectContent>
            </Select>
          </Fld>
          <Fld l="تاريخ الصرف"><Input type="date" value={f.paid_date ?? ""} onChange={(e) => setF({ ...f, paid_date: e.target.value })} /></Fld>
          <div className="sm:col-span-2"><Fld l="ملاحظات"><Textarea value={f.notes ?? ""} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Fld></div>
          <div className="space-y-2 sm:col-span-2">
            <div className="text-sm font-medium">طلبات الاستلام المرتبطة (كود A أو B فقط)</div>
            {eligible.length === 0 && <div className="text-xs text-muted-foreground">لا توجد WIRs معتمدة بعد</div>}
            {eligible.map((w) => (
              <label key={w.id} className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-sm">
                <Checkbox checked={selected.has(w.id)} onCheckedChange={(v) => toggle(w.id, v === true)} />
                <span dir="ltr" className="font-mono text-xs">{w.ref_no}</span><span className="flex-1 truncate">{w.title}</span><CodeBadge code={w.code} />
              </label>
            ))}
          </div>
          <div className="space-y-2 sm:col-span-2">
            <div className="text-sm font-medium">المرفقات</div>
            {atts.map((a) => <Button key={a.path} variant="outline" size="sm" className="me-2" onClick={() => openFile(a.path)}><FileText className="h-4 w-4" /> {a.name}</Button>)}
            <label className="flex w-max cursor-pointer items-center gap-1 rounded-md bg-secondary px-3 py-1.5 text-sm text-secondary-foreground hover:bg-secondary/80">
              <Upload className="h-4 w-4" /> رفع مرفق
              <input type="file" className="hidden" disabled={busy} onChange={(e) => { const file = e.target.files?.[0]; if (file) upload(file); e.target.value = ""; }} />
            </label>
          </div>
        </div>
        {f.id && (
          <div className="space-y-2 border-t border-border pt-3">
            <div className="text-sm font-semibold">سجل المتابعة</div>
            <ul className="space-y-1.5">
              {(notesQ.data ?? []).map((n) => (
                <li key={n.id} className="rounded-md bg-muted px-3 py-2 text-sm">
                  <div className="text-xs text-muted-foreground">{n.note_date} · {n.author_name || "—"}</div>
                  <div className="whitespace-pre-wrap">{n.note}</div>
                </li>
              ))}
              {notesQ.data?.length === 0 && <li className="text-xs text-muted-foreground">لا توجد ملاحظات</li>}
            </ul>
            <div className="flex gap-2"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="أضف ملاحظة متابعة" /><Button variant="outline" onClick={addNote}>إضافة</Button></div>
          </div>
        )}
        <DialogFooter><Button onClick={save} disabled={busy}>حفظ</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
