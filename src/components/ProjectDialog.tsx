import { t, useLanguage, locale } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { autoStatus, plannedFromDates, newId, projectStore, SECTORS, STATUS_OPTIONS, CLIENT_CAPACITIES, OUR_ROLES, warrantyInfo, type Project } from "@/lib/projects";
import { findDuplicate } from "@/lib/bloom";

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
        <Select value={f[k] ?? ""} onValueChange={(v) => {
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
  const choice = (k: "clientCapacity" | "ourRole", label: string, opts: string[]) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={f[k] ?? ""} onValueChange={(v) => set(k, v)}>
        <SelectTrigger><SelectValue placeholder={label} /></SelectTrigger>
        <SelectContent>{opts.map((s) => <SelectItem key={s} value={s}>{t(s)}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
  const warrantyBad = f.hasWarranty === "نعم" && (f.freeRepairYears ?? 0) > (f.warrantyYears ?? Infinity);
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
          {text("location", t("موقع المشروع"))}
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{t("مالك المشروع")}</Label>
            <Input value={f.owner ?? ""} onChange={(e) => set("owner", e.target.value)} />
            <p className="text-xs text-muted-foreground">{t("الجهة المالكة للمشروع النهائي (مثل شركة الدرعية)، وليست شركتنا")}</p>
          </div>
          {text("mainContractor", t("المقاول الرئيسي (اختياري)"))}
          {text("client", t("العميل المتعاقد معنا"))}
          {choice("clientCapacity", t("صفة العميل"), CLIENT_CAPACITIES)}
          {choice("ourRole", t("دورنا في المشروع"), OUR_ROLES)}
          {pick("sector", t("القطاع"), SECTORS)}
          {pick("dept", t("الإدارة"), ["المشاريع"])}
          {pick("manager", t("مدير المشروع"), managers)}
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
          {plannedFromDates(f) === null ? num("planned", t("نسبة الإنجاز المخطط %"), true)
            : <div className="space-y-1.5"><Label>{t("نسبة الإنجاز المخطط %")} ({t("تلقائي من التاريخ")})</Label><Input disabled dir="ltr" value={`${Math.round(plannedFromDates(f)! * 100)}%`} /></div>}
          {num("contract", t("قيمة العقد"))}
          {num("paid", t("المدفوع"))}
          <div className="space-y-3 rounded-lg border border-border p-3 sm:col-span-2">
            <h3 className="font-display font-bold">{t("الضمان")}</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t("هل يوجد ضمان؟")}</Label>
                <Select value={f.hasWarranty ?? ""} onValueChange={(v) => set("hasWarranty", v)}>
                  <SelectTrigger><SelectValue placeholder={t("هل يوجد ضمان؟")} /></SelectTrigger>
                  <SelectContent><SelectItem value="نعم">{t("نعم")}</SelectItem><SelectItem value="لا">{t("لا")}</SelectItem></SelectContent>
                </Select>
              </div>
              {f.hasWarranty === "نعم" && (() => {
                const w = warrantyInfo(f);
                const yrs = (k: "warrantyYears" | "freeRepairYears", label: string) => (
                  <div className="space-y-1.5">
                    <Label>{label}</Label>
                    <Input type="number" min={0} step={0.5} dir="ltr" value={f[k] ?? ""} onChange={(e) => set(k, e.target.value === "" ? undefined : Number(e.target.value))} />
                  </div>
                );
                return (
                  <>
                    {text("warrantyNo", t("رقم خطاب الضمان"))}
                    {yrs("warrantyYears", t("مدة الضمان (سنوات)"))}
                    <div className="space-y-1.5">
                      <Label>{t("تاريخ التسليم النهائي")}</Label>
                      <Input type="date" dir="ltr" value={f.deliveryDate ?? ""} onChange={(e) => set("deliveryDate", e.target.value || null)} />
                    </div>
                    {yrs("freeRepairYears", t("فترة الإصلاح المجاني (سنوات)"))}
                    <div className="space-y-1.5"><Label>{t("تاريخ نهاية الإصلاح المجاني")}</Label><Input disabled dir="ltr" value={w?.freeEnd ?? "—"} /></div>
                    <div className="space-y-1.5"><Label>{t("تاريخ انتهاء الضمان")}</Label><Input disabled dir="ltr" value={w?.end ?? "—"} /></div>
                    <div className="space-y-1.5"><Label>{t("حالة الضمان")}</Label><Input disabled value={t(w?.status ?? "لم يبدأ")} /></div>
                    {warrantyBad && <p className="text-sm text-destructive sm:col-span-2">{t("فترة الإصلاح المجاني لا يمكن أن تكون أطول من مدة الضمان")}</p>}
                    <p className="text-xs text-muted-foreground sm:col-span-2">{t("ارفع خطاب الضمان من «ملفات المشروع» داخل بطاقة المشروع")}</p>
                  </>
                );
              })()}
            </div>
          </div>
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
          <Button disabled={!f.name.trim() || warrantyBad} onClick={() => {
            const others = projectStore.all().filter((p) => p.id !== f.id);
            const dup = [
              findDuplicate(others.map((p) => p.code), f.code) ? `${t("رمز المشروع")}: ${f.code}` : "",
              findDuplicate(others.map((p) => p.name), f.name) ? `${t("اسم المشروع")}: ${f.name}` : "",
            ].filter(Boolean);
            if (dup.length && !confirm(`${t("يوجد مشروع مسجل بنفس البيانات")}\n${dup.join("\n")}\n${t("هل تريد الحفظ على أي حال؟")}`)) return;
            projectStore.upsert(f); onOpenChange(false);
          }}>
            {t("حفظ")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
