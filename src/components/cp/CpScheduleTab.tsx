import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PdfButton } from "@/components/PdfButton";
import { daysBetween, ganttRange, iso, plannedProgress, scheduleProgress, type CpActivity } from "@/lib/cp";
import { Fld } from "./CpOverview";

export const actKey = (p: string) => ["cp", "activities", p] as const;
export async function fetchActs(projectId: string) {
  const { data, error } = await supabase.from("schedule_activities").select("*").eq("project_id", projectId).order("sort").order("start_date");
  if (error) throw error;
  return data;
}

export function CpScheduleTab({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const { data: acts = [] } = useQuery({ queryKey: actKey(projectId), queryFn: () => fetchActs(projectId) });
  const { data: canEdit = false } = useQuery({
    queryKey: ["cp", "can-plan", projectId],
    queryFn: async () => { const { data } = await supabase.rpc("cp_can_plan", { _project: projectId }); return !!data; },
  });
  const [open, setOpen] = useState<Partial<CpActivity> | null>(null);
  const range = ganttRange(acts);
  const today = iso(Date.now());
  const byId = new Map(acts.map((a) => [a.id, a]));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat l="الإنجاز الفعلي" v={`${scheduleProgress(acts)}%`} />
        <Stat l="الإنجاز المخطط حتى اليوم" v={`${plannedProgress(acts, today)}%`} />
        <Stat l="عدد الأنشطة" v={String(acts.length)} />
      </div>
      <div className="flex flex-wrap gap-2">
        <PdfButton />
        <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" /> طباعة</Button>
        {canEdit && <Button className="ms-auto" onClick={() => setOpen({ progress: 0, start_date: today, end_date: today, owner: "" })}><Plus className="h-4 w-4" /> نشاط جديد</Button>}
      </div>
      <div data-report-document className="space-y-3 bg-background">
        <h2 className="hidden text-lg font-bold print:block">الجدول الزمني</h2>
        <Card><CardContent className="overflow-x-auto p-0">
          {!range ? <p className="p-8 text-center text-muted-foreground">لا توجد أنشطة بعد</p> : (
            <Gantt acts={acts} range={range} today={today} byId={byId} onPick={canEdit ? setOpen : undefined} />
          )}
        </CardContent></Card>
      </div>
      {open && <ActDialog projectId={projectId} draft={open} acts={acts} onClose={() => setOpen(null)} onSaved={() => { qc.invalidateQueries({ queryKey: actKey(projectId) }); setOpen(null); }} />}
    </div>
  );
}

function Gantt({ acts, range, today, byId, onPick }: {
  acts: CpActivity[]; range: { start: string; end: string; days: number }; today: string;
  byId: Map<string, CpActivity>; onPick?: (a: CpActivity) => void;
}) {
  const pct = (d: string) => (daysBetween(range.start, d) / range.days) * 100;
  // Month ticks
  const months: { l: string; at: number }[] = [];
  const s = new Date(range.start + "T00:00:00Z");
  for (let d = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), 1)); iso(d.getTime()) <= range.end; d.setUTCMonth(d.getUTCMonth() + 1)) {
    const k = iso(d.getTime());
    months.push({ l: d.toLocaleDateString("ar-SA-u-ca-gregory", { month: "short", year: "2-digit", timeZone: "UTC" }), at: Math.max(0, pct(k)) });
  }
  const showToday = today >= range.start && today <= range.end;
  return (
    <div className="min-w-[720px]" dir="rtl">
      <div className="grid grid-cols-[220px_1fr] border-b border-border text-xs text-muted-foreground">
        <div className="p-2 font-medium">النشاط</div>
        <div className="relative h-8">
          {months.map((m) => <span key={m.at} className="absolute top-2 border-s border-border ps-1" style={{ insetInlineStart: `${m.at}%` }}>{m.l}</span>)}
        </div>
      </div>
      {acts.map((a) => {
        const dep = a.depends_on ? byId.get(a.depends_on) : null;
        const late = Number(a.progress) < 100 && a.end_date < today;
        return (
          <div key={a.id} className={`grid grid-cols-[220px_1fr] border-b border-border text-sm ${onPick ? "cursor-pointer hover:bg-muted/40" : ""}`} onClick={() => onPick?.(a)}>
            <div className="space-y-0.5 p-2">
              <div className="font-medium text-foreground">{a.name}</div>
              <div className="text-xs text-muted-foreground">{a.owner || "—"} · {a.start_date} ← {a.end_date}</div>
              {dep && <div className="text-xs text-muted-foreground">يعتمد على: {dep.name}</div>}
            </div>
            <div className="relative h-14">
              {showToday && <div className="absolute inset-y-0 w-px bg-destructive" style={{ insetInlineStart: `${pct(today)}%` }} />}
              <div className={`absolute top-4 h-6 overflow-hidden rounded ${late ? "bg-destructive/25" : "bg-primary/20"}`}
                style={{ insetInlineStart: `${pct(a.start_date)}%`, width: `${Math.max(1, ((daysBetween(a.start_date, a.end_date) + 1) / range.days) * 100)}%` }}>
                <div className={`h-full ${late ? "bg-destructive" : "bg-primary"}`} style={{ width: `${a.progress}%` }} />
                <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-foreground">{Number(a.progress)}%</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ActDialog({ projectId, draft, acts, onClose, onSaved }: {
  projectId: string; draft: Partial<CpActivity>; acts: CpActivity[]; onClose: () => void; onSaved: () => void;
}) {
  const [d, setD] = useState(draft);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof CpActivity, v: unknown) => setD((p) => ({ ...p, [k]: v }));
  const save = async () => {
    if (!d.name?.trim()) { toast.error("اكتب اسم النشاط"); return; }
    if (!d.start_date || !d.end_date || d.end_date < d.start_date) { toast.error("تاريخ النهاية يجب أن يكون بعد البداية"); return; }
    setBusy(true);
    const row = {
      name: d.name.trim(), start_date: d.start_date, end_date: d.end_date,
      progress: Math.min(100, Math.max(0, Number(d.progress) || 0)), owner: d.owner ?? "", depends_on: d.depends_on || null,
    };
    const { error } = d.id
      ? await supabase.from("schedule_activities").update(row).eq("id", d.id)
      : await supabase.from("schedule_activities").insert({ ...row, project_id: projectId, sort: acts.length + 1 });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم الحفظ"); onSaved();
  };
  const del = async () => {
    if (!d.id || !confirm("حذف النشاط؟")) return;
    const { error } = await supabase.from("schedule_activities").delete().eq("id", d.id);
    if (error) { toast.error(error.message); return; }
    onSaved();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{d.id ? "تعديل نشاط" : "نشاط جديد"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Fld l="اسم النشاط"><Input value={d.name ?? ""} onChange={(e) => set("name", e.target.value)} /></Fld></div>
          <Fld l="تاريخ البداية"><Input type="date" value={d.start_date ?? ""} onChange={(e) => set("start_date", e.target.value)} /></Fld>
          <Fld l="تاريخ النهاية"><Input type="date" value={d.end_date ?? ""} onChange={(e) => set("end_date", e.target.value)} /></Fld>
          <Fld l="نسبة الإنجاز %"><Input type="number" min={0} max={100} value={d.progress ?? 0} onChange={(e) => set("progress", e.target.value)} /></Fld>
          <Fld l="المسؤول"><Input value={d.owner ?? ""} onChange={(e) => set("owner", e.target.value)} /></Fld>
          <div className="sm:col-span-2"><Fld l="يعتمد على">
            <Select value={d.depends_on ?? "none"} onValueChange={(v) => set("depends_on", v === "none" ? null : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">لا يوجد</SelectItem>
                {acts.filter((a) => a.id !== d.id).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Fld></div>
        </div>
        <DialogFooter className="gap-2">
          {d.id && <Button variant="destructive" onClick={del}>حذف</Button>}
          <Button disabled={busy} onClick={save}>حفظ</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Stat({ l, v }: { l: string; v: string }) {
  return <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">{l}</div><div className="mt-1 text-xl font-bold text-foreground">{v}</div></CardContent></Card>;
}
