import { t, useLanguage, locale } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { autoStatus, newId, projectStore, SECTORS, STATUS_OPTIONS, type Project } from "@/lib/projects";

const empty = (): Project => ({
  id: newId(), code: "", name: "", sector: "", dept: "المشاريع", manager: "", owner: "Metal Fuze",
  start: null, end: null, status: "طبيعي", progress: 0, planned: 0, contract: 0, paid: 0,
  hasContract: "نعم", issues: "", notes: "",
});

export function ProjectDialog({
  open, onOpenChange, project, managers,
}: { open: boolean; onOpenChange: (o: boolean) => void; project: Project | null; managers: string[] }) {
  useLanguage();
  const [f, setF] = useState<Project>(empty());
  const [extra, setExtra] = useState<Record<"sector" | "dept" | "manager", string[]>>({ sector: [], dept: [], manager: [] });
  useEffect(() => { if (open) setF(project ?? empty()); }, [open, project]);
  const set = <K extends keyof Project>(k: K, v: Project[K]) => setF((p) => ({ ...p, [k]: v }));
  // Status suggests itself from the dates; picking an option manually keeps it until a date changes.
  useEffect(() => {
    setF((p) => {
      const auto = autoStatus(p);
      return auto === p.status ? p : { ...p, status: auto };
    });
  }, [f.start, f.end, f.actualEnd]);

  const text = (k: keyof Project, label: string, list?: string) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input list={list} value={(f[k] as string) ?? ""} onChange={(e) => set(k, e.target.value as never)} />
    </div>
  );
  const ADD = "__add__";
  const pick = (k: "sector" | "dept" | "manager", label: string, defaults: string[] = []) => {
    const opts = [...new Set([...defaults, ...extra[k], ...projectStore.all().map((p) => p[k]), f[k]].map((s) => (s ?? "").trim()).filter(Boolean))];
    return (
      <div className="space-y-1.5">
        <Label>{label}</Label>
        <Select value={f[k] || undefined} onValueChange={(v) => {
          if (v !== ADD) return set(k, v);
          const n = window.prompt(t("اكتب الاسم الجديد"))?.trim();
          if (n) { setExtra((e) => ({ ...e, [k]: [...e[k], n] })); set(k, n); }
        }}>
          <SelectTrigger><SelectValue placeholder={label} /></SelectTrigger>
          <SelectContent>
            {opts.map((s) => <SelectItem key={s} value={s}>{t(s)}</SelectItem>)}
            <SelectItem value={ADD}>+ {t("إضافة خيار جديد")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    );
  };
  const num = (k: keyof Project, label: string, pct = false) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type="number" dir="ltr"
        value={pct ? Math.round((f[k] as number) * 100) : (f[k] as number)}
        onChange={(e) => set(k, (pct ? Number(e.target.value) / 100 : Number(e.target.value)) as never)} />
    </div>
  );
  const date = (k: "start" | "end" | "actualEnd", label: string) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type="date" dir="ltr" value={f[k] ?? ""} onChange={(e) => set(k, e.target.value || null)} />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir={locale() === "en-GB" ? "ltr" : "rtl"} className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{project ? t("تعديل مشروع") : t("إضافة مشروع جديد")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          {text("name", t("اسم المشروع"))}
          {text("code", t("رمز المشروع"))}
          {text("client", t("اسم العميل"))}
          {pick("sector", t("القطاع"), SECTORS)}
          {pick("dept", t("الإدارة"), ["المشاريع"])}
          {pick("manager", t("مدير المشروع"), managers)}
          {text("owner", t("مالك المشروع"))}
          {date("start", t("تاريخ البداية"))}
          {date("end", t("تاريخ الانتهاء"))}
          {date("actualEnd", t("تاريخ الانتهاء الفعلي"))}
          <div className="space-y-1.5">
            <Label>{t("حالة المشروع")}</Label>
            <Select value={f.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue placeholder={t("حالة المشروع")} /></SelectTrigger>
              <SelectContent>
                {[...new Set([...STATUS_OPTIONS, f.status].filter(Boolean))].map((s) => (
                  <SelectItem key={s} value={s}>{t(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {text("hasContract", t("هل يوجد عقد شركة"))}
          {num("progress", t("نسبة الإنجاز %"), true)}
          {num("planned", t("نسبة الإنجاز المخطط %"), true)}
          {num("contract", t("قيمة العقد"))}
          {num("paid", t("المدفوع"))}
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{t("الإشكاليات / العوائق")}</Label>
            <Textarea value={f.issues} onChange={(e) => set("issues", e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{t("ملاحظات مهمة")}</Label>
            <Textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("إلغاء")}</Button>
          <Button disabled={!f.name.trim()} onClick={() => { projectStore.upsert(f); onOpenChange(false); }}>
            {t("حفظ")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
