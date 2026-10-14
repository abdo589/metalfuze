import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { newId, projectStore, SECTORS, STATUSES, type Project } from "@/lib/projects";

const empty = (): Project => ({
  id: newId(), code: "", name: "", sector: "", dept: "المشاريع", manager: "", owner: "Metal Fuze",
  start: null, end: null, status: "طبيعي", progress: 0, planned: 0, contract: 0, paid: 0,
  hasContract: "نعم", issues: "", notes: "",
});

export function ProjectDialog({
  open, onOpenChange, project, managers,
}: { open: boolean; onOpenChange: (o: boolean) => void; project: Project | null; managers: string[] }) {
  const [f, setF] = useState<Project>(empty());
  useEffect(() => { if (open) setF(project ?? empty()); }, [open, project]);
  const set = <K extends keyof Project>(k: K, v: Project[K]) => setF((p) => ({ ...p, [k]: v }));

  const text = (k: keyof Project, label: string, list?: string) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input list={list} value={(f[k] as string) ?? ""} onChange={(e) => set(k, e.target.value as never)} />
    </div>
  );
  const num = (k: keyof Project, label: string, pct = false) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type="number" dir="ltr"
        value={pct ? Math.round((f[k] as number) * 100) : (f[k] as number)}
        onChange={(e) => set(k, (pct ? Number(e.target.value) / 100 : Number(e.target.value)) as never)} />
    </div>
  );
  const date = (k: "start" | "end", label: string) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type="date" dir="ltr" value={f[k] ?? ""} onChange={(e) => set(k, e.target.value || null)} />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{project ? "تعديل مشروع" : "إضافة مشروع جديد"}</DialogTitle>
        </DialogHeader>
        <datalist id="sectors">{SECTORS.map((s) => <option key={s} value={s} />)}</datalist>
        <datalist id="statuses">{STATUSES.map((s) => <option key={s} value={s} />)}</datalist>
        <datalist id="managers">{managers.map((s) => <option key={s} value={s} />)}</datalist>
        <div className="grid gap-4 sm:grid-cols-2">
          {text("name", "اسم المشروع")}
          {text("code", "رمز المشروع")}
          {text("sector", "القطاع", "sectors")}
          {text("dept", "الإدارة")}
          {text("manager", "مدير المشروع", "managers")}
          {text("owner", "مالك المشروع")}
          {date("start", "تاريخ البداية")}
          {date("end", "تاريخ الانتهاء")}
          {text("status", "حالة المشروع", "statuses")}
          {text("hasContract", "هل يوجد عقد شركة")}
          {num("progress", "نسبة الإنجاز %", true)}
          {num("planned", "نسبة الإنجاز المخطط %", true)}
          {num("contract", "قيمة العقد")}
          {num("paid", "المدفوع")}
          <div className="space-y-1.5 sm:col-span-2">
            <Label>الإشكاليات / العوائق</Label>
            <Textarea value={f.issues} onChange={(e) => set("issues", e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>ملاحظات مهمة</Label>
            <Textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button disabled={!f.name.trim()} onClick={() => { projectStore.upsert(f); onOpenChange(false); }}>
            حفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
