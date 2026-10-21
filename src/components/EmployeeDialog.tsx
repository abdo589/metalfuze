import { t, useLanguage, locale } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { newEmpId, type Employee } from "@/lib/payroll";

const empty: Employee = {
  id: "",
  name: "",
  role: "",
  dept: "",
  project: "",
  base: 0,
  allowances: 0,
  deductions: 0,
  joined: null,
  active: true,
  paidMonths: [],
};

export function EmployeeDialog({
  open,
  onOpenChange,
  employee,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employee: Employee | null;
  onSave: (e: Employee) => void;
}) {
  useLanguage();
  const [form, setForm] = useState<Employee>(empty);

  useEffect(() => {
    if (open) setForm(employee ?? { ...empty, id: newEmpId() });
  }, [open, employee]);

  const set = <K extends keyof Employee>(k: K, v: Employee[K]) => setForm((f) => ({ ...f, [k]: v }));
  const num = (v: string) => Number(v) || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{employee ? t("تعديل موظف") : t("إضافة موظف")}</DialogTitle>
        </DialogHeader>
        <form
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            onSave(form);
            onOpenChange(false);
          }}
        >
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{t("اسم الموظف")}</Label>
            <Input required value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("المسمى الوظيفي")}</Label>
            <Input value={form.role} onChange={(e) => set("role", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("الإدارة")}</Label>
            <Input value={form.dept} onChange={(e) => set("dept", e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{t("البريد الإلكتروني (لربط حساب الموظف)")}</Label>
            <Input type="email" dir="ltr" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} placeholder="name@company.com" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{t("رقم الموظف في جهاز البصمة")}</Label>
            <Input value={form.deviceUserId ?? ""} onChange={(e) => set("deviceUserId", e.target.value)} placeholder="1" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>{t("المشروع (اختياري)")}</Label>
            <Input value={form.project} onChange={(e) => set("project", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("الراتب الأساسي")}</Label>
            <Input type="text" inputMode="decimal" dir="ltr" placeholder="0" value={form.base || ""} onChange={(e) => set("base", num(e.target.value.replace(/[^\d.]/g, "")))} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("البدلات")}</Label>
            <Input type="text" inputMode="decimal" dir="ltr" placeholder="0" value={form.allowances || ""} onChange={(e) => set("allowances", num(e.target.value.replace(/[^\d.]/g, "")))} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("الخصومات")}</Label>
            <Input type="text" inputMode="decimal" dir="ltr" placeholder="0" value={form.deductions || ""} onChange={(e) => set("deductions", num(e.target.value.replace(/[^\d.]/g, "")))} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("تاريخ التعيين")}</Label>
            <Input type="date" value={form.joined ?? ""} onChange={(e) => set("joined", e.target.value || null)} />
          </div>
          <label className="flex items-center gap-2 sm:col-span-2">
            <input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} className="size-4 accent-primary" />
            <span className="text-sm">{t("موظف نشط (يظهر في مسير الرواتب)")}</span>
          </label>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("إلغاء")}</Button>
            <Button type="submit">{t("حفظ")}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
