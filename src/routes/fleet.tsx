import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Car, CheckCircle2, Clock, Eye, FileSpreadsheet, LoaderCircle, Mail, Pencil, Plus, Search, Trash2, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useCanEdit } from "@/lib/permissions";
import { t, useLanguage } from "@/lib/i18n";
import { StatCard } from "@/components/ResidenciesPanel";
import { PdfButton } from "@/components/PdfButton";
import { daysLeft } from "@/lib/residency";

export const Route = createFileRoute("/fleet")({
  head: () => ({
    meta: [
      { title: "سجل السيارات والمخالفات — Metal Fuze" },
      { name: "description", content: "إدارة سيارات الشركة وربطها بالموظفين ومتابعة المخالفات المرورية." },
      { property: "og:title", content: "سجل السيارات والمخالفات — Metal Fuze" },
      { property: "og:description", content: "سيارات الشركة، التسليم والاستلام، والمخالفات المرورية وإشعار الموظفين." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FleetPage,
});

type CarRow = { id: string; plate: string; car_type: string; model_year: string; employee_no: string; employee_name: string; handover_date: string | null; return_date: string | null; status: string; registration_expiry: string | null; insurance_company: string; insurance_expiry: string | null; notes: string };
type Vio = { id: string; violation_no: string; violation_type: string; plate: string; employee_no: string; employee_name: string; violation_date: string | null; violation_time: string; location: string; amount: number; status: string; notes: string };
type Emp = { no: string; name: string; email: string };

const CAR_STATUSES = ["مسلمة للموظف", "متاحة", "صيانة", "خارج الخدمة"];
const VIO_STATUSES = ["جديدة", "تم إشعار الموظف", "بانتظار السداد", "تم السداد"];
const VIO_TYPES = ["تجاوز السرعة", "قطع إشارة", "مواقف خاطئة", "عدم ربط الحزام", "استخدام الجوال", "أخرى"];
const carCls: Record<string, string> = { "مسلمة للموظف": "bg-success/15 text-success", "متاحة": "bg-primary/15 text-primary", "صيانة": "bg-warning/15 text-warning", "خارج الخدمة": "bg-destructive/15 text-destructive" };
const vioCls: Record<string, string> = { "جديدة": "bg-destructive/15 text-destructive", "تم إشعار الموظف": "bg-primary/15 text-primary", "بانتظار السداد": "bg-warning/15 text-warning", "تم السداد": "bg-success/15 text-success" };

const emptyCar = (): Omit<CarRow, "id"> & { id?: string } => ({ plate: "", car_type: "", model_year: "", employee_no: "", employee_name: "", handover_date: "", return_date: "", status: CAR_STATUSES[0]!, registration_expiry: "", insurance_company: "", insurance_expiry: "", notes: "" });
const emptyVio = (): Omit<Vio, "id"> & { id?: string } => ({ violation_no: "", violation_type: VIO_TYPES[0]!, plate: "", employee_no: "", employee_name: "", violation_date: "", violation_time: "", location: "", amount: 0, status: VIO_STATUSES[0]!, notes: "" });
const nn = (v: string | null) => (v ? v : null);
const sel = "h-9 w-full rounded-md border bg-background px-2 text-sm";

const F = ({ label, children }: { label: string; children: React.ReactNode }) => <label className="space-y-1 text-sm"><span className="text-muted-foreground">{t(label)}</span>{children}</label>;
function FleetPage() {
  useLanguage();
  const canEdit = useCanEdit();
  const [tab, setTab] = useState<"cars" | "vios" | "handover">("cars");
  const [cars, setCars] = useState<CarRow[]>([]);
  const [vios, setVios] = useState<Vio[]>([]);
  const [emps, setEmps] = useState<Emp[]>([]);
  const [q, setQ] = useState("");
  const [editCar, setEditCar] = useState<ReturnType<typeof emptyCar> | null>(null);
  const [editVio, setEditVio] = useState<ReturnType<typeof emptyVio> | null>(null);
  const [view, setView] = useState<CarRow | null>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    const [c, v, e] = await Promise.all([
      supabase.from("fleet_cars").select("*").order("created_at"),
      supabase.from("traffic_violations").select("*").order("violation_date", { ascending: false }),
      supabase.from("hr_records").select("data").eq("sheet", "employees").order("sort"),
    ]);
    setCars((c.data ?? []) as CarRow[]);
    setVios((v.data ?? []) as Vio[]);
    const seen = new Set<string>();
    setEmps(((e.data ?? []) as { data: Record<string, unknown> }[]).map(({ data: d }) => ({ no: String(d["رقم الموظف"] ?? "").trim(), name: String(d["اسم الموظف"] ?? "").trim(), email: String(d["البريد الإلكتروني"] ?? "").trim() }))
      .filter((x) => x.name && !seen.has(x.no + x.name) && seen.add(x.no + x.name)));
  }, []);
  useEffect(() => { load(); }, [load]);

  const match = (s: string) => !q || s.toLowerCase().includes(q.toLowerCase());
  const carList = cars.filter((c) => match(`${c.plate} ${c.car_type} ${c.employee_name} ${c.employee_no}`));
  const vioList = vios.filter((v) => match(`${v.plate} ${v.violation_no} ${v.employee_name} ${v.location}`));
  const unpaid = useMemo(() => vios.filter((v) => v.status !== "تم السداد").reduce((s, v) => s + Number(v.amount || 0), 0), [vios]);

  async function exportFleet() {
    setExporting(true);
    try {
      const { exportBrandedExcel } = await import("@/lib/branded-excel");
      await exportBrandedExcel({
        filename: `Metal-Fuze-سيارات-ومخالفات-${new Date().toISOString().slice(0, 10)}.xlsx`,
        reportTitle: `METAL FUZE — ${t("سجل السيارات والمخالفات")}`,
        summary: [
          [t("عدد السيارات"), cars.length, "int"],
          [t("مسلمة للموظفين"), cars.filter((c) => c.status === "مسلمة للموظف").length, "int"],
          [t("مخالفات غير مسددة"), vios.filter((v) => v.status !== "تم السداد").length, "int"],
          [t("مبالغ غير مسددة (ريال)"), unpaid, "money"],
        ],
        sheets: [
          { name: "جميع السيارات", title: t("جميع السيارات"), columns: [
            { header: t("رقم اللوحة"), width: 14 }, { header: t("نوع السيارة"), width: 16 }, { header: t("الموديل"), width: 10 },
            { header: t("الموظف المسؤول"), width: 22 }, { header: t("رقم الموظف"), width: 12 },
            { header: t("تاريخ التسليم"), width: 14 }, { header: t("تاريخ الاستلام"), width: 14 },
            { header: t("تاريخ انتهاء الاستمارة"), width: 16 }, { header: t("تاريخ انتهاء التأمين"), width: 16 },
            { header: t("شركة التأمين"), width: 18 }, { header: t("الحالة"), width: 16 }, { header: t("ملاحظات"), width: 30 },
          ], rows: cars.map((c) => [c.plate, c.car_type, c.model_year, c.employee_name, c.employee_no, c.handover_date, c.return_date, c.registration_expiry, c.insurance_expiry, c.insurance_company, t(c.status), c.notes]) },
          { name: "المخالفات المرورية", title: t("المخالفات المرورية"), columns: [
            { header: t("رقم المخالفة"), width: 14 }, { header: t("نوع المخالفة"), width: 18 }, { header: t("رقم اللوحة"), width: 14 },
            { header: t("الموظف"), width: 22 }, { header: t("تاريخ المخالفة"), width: 14 }, { header: t("الوقت"), width: 10 },
            { header: t("الموقع"), width: 20 }, { header: t("المبلغ"), width: 14, format: "money" }, { header: t("الحالة"), width: 18 }, { header: t("ملاحظات"), width: 30 },
          ], rows: vios.map((v) => [v.violation_no, t(v.violation_type), v.plate, v.employee_name, v.violation_date, v.violation_time, v.location, Number(v.amount) || 0, t(v.status), v.notes]), totals: [7] },
        ],
      });
      toast.success(t("تم تصدير التقرير"));
    } catch { toast.error(t("تعذر التصدير")); }
    finally { setExporting(false); }
  }

  function pickEmp<T extends { employee_no: string; employee_name: string }>(d: T, key: string): T {
    const e = emps.find((x) => x.no + "|" + x.name === key);
    return { ...d, employee_no: e?.no ?? "", employee_name: e?.name ?? "" };
  }

  async function saveCar() {
    if (!editCar?.plate.trim()) { toast.error(t("رقم اللوحة مطلوب")); return; }
    const { id, ...rest } = editCar;
    const row = { ...rest, handover_date: nn(rest.handover_date), return_date: nn(rest.return_date), registration_expiry: nn(rest.registration_expiry), insurance_expiry: nn(rest.insurance_expiry) };
    const { error } = id ? await supabase.from("fleet_cars").update(row).eq("id", id) : await supabase.from("fleet_cars").insert(row);
    if (error) { toast.error(error.message); return; }
    toast.success(t("تم الحفظ")); setEditCar(null); load();
  }
  async function saveVio() {
    if (!editVio) return;
    const { id, ...rest } = editVio;
    const car = cars.find((c) => c.plate === rest.plate);
    const row = { ...rest, amount: Number(rest.amount) || 0, violation_date: nn(rest.violation_date),
      employee_no: rest.employee_no || car?.employee_no || "", employee_name: rest.employee_name || car?.employee_name || "" };
    const { error } = id ? await supabase.from("traffic_violations").update(row).eq("id", id) : await supabase.from("traffic_violations").insert(row);
    if (error) { toast.error(error.message); return; }
    toast.success(t("تم الحفظ")); setEditVio(null); load();
  }
  async function del(table: "fleet_cars" | "traffic_violations", id: string) {
    if (!confirm(t("حذف نهائي؟"))) return;
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    load();
  }
  async function notify(v: Vio) {
    const email = emps.find((e) => e.no === v.employee_no && e.name === v.employee_name)?.email ?? emps.find((e) => e.name === v.employee_name)?.email ?? "";
    const subject = `إشعار مخالفة مرورية - سيارة رقم ${v.plate}`;
    const body = `مرحبًا ${v.employee_name}،\n\nتم تسجيل مخالفة مرورية على السيارة المسلّمة لك:\nرقم المخالفة: ${v.violation_no}\nنوع المخالفة: ${v.violation_type}\nرقم اللوحة: ${v.plate}\nالتاريخ: ${v.violation_date ?? ""}\nالوقت: ${v.violation_time}\nالموقع: ${v.location}\nالمبلغ: ${v.amount} ريال\n\nيرجى سداد المخالفة في أقرب وقت ممكن.\n\nمع تحيات،\nMetal Fuze - قسم الموارد البشرية`;
    window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    if (canEdit && v.status === "جديدة") { await supabase.from("traffic_violations").update({ status: "تم إشعار الموظف" }).eq("id", v.id); load(); }
  }

  const Badge = ({ s, map }: { s: string; map: Record<string, string> }) => <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs ${map[s] ?? "bg-muted"}`}>{t(s)}</span>;
  const expiryNote = (d: string | null) => { if (!d) return "—"; const n = daysLeft(d) ?? 0; return <span className={n < 0 ? "text-destructive" : n <= 30 ? "text-warning" : ""}>{d}</span>; };
  const EmpSelect = ({ value, onChange }: { value: string; onChange: (k: string) => void }) => (
    <select className={sel} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">—</option>
      {emps.map((e) => <option key={e.no + e.name} value={e.no + "|" + e.name}>{e.name}{e.no ? ` (${e.no})` : ""}</option>)}
    </select>
  );

  return (
    <main className="mx-auto max-w-7xl space-y-5 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Car className="size-6 text-primary" /> {t("سجل السيارات والمخالفات")}</h1>
          <p className="text-sm text-muted-foreground">{t("إدارة سيارات الشركة وربطها بالموظفين ومتابعة المخالفات وإشعار الموظفين عبر البريد")}</p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button variant="outline" disabled={exporting} onClick={exportFleet}>{exporting ? <LoaderCircle className="animate-spin" /> : <FileSpreadsheet />}{t("تصدير Excel")}</Button>
          <PdfButton />
          {canEdit && <Button variant="outline" onClick={() => setEditVio(emptyVio())}><Plus /> {t("إضافة مخالفة")}</Button>}
          {canEdit && <Button onClick={() => setEditCar(emptyCar())}><Plus /> {t("إضافة سيارة")}</Button>}
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label={t("عدد السيارات")} value={cars.length} icon={<Car className="size-5 text-primary" />} cls="border-border bg-card" />
        <StatCard label={t("مسلمة للموظفين")} value={cars.filter((c) => c.status === "مسلمة للموظف").length} icon={<CheckCircle2 className="size-5 text-success" />} cls="border-success/40 bg-success/10" />
        <StatCard label={t("مخالفات غير مسددة")} value={vios.filter((v) => v.status !== "تم السداد").length} icon={<AlertTriangle className="size-5 text-destructive" />} cls="border-destructive/40 bg-destructive/10" />
        <StatCard label={t("مبالغ غير مسددة (ريال)")} value={unpaid} icon={<Clock className="size-5 text-warning" />} cls="border-warning/40 bg-warning/10" />
      </section>

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        {([["cars", "جميع السيارات"], ["vios", "المخالفات المرورية"], ["handover", "تسليم واستلام السيارات"]] as const).map(([k, l]) => (
          <Button key={k} size="sm" variant={tab === k ? "default" : "outline"} onClick={() => setTab(k)}>{t(l)}</Button>
        ))}
        <div className="relative ms-auto w-full sm:w-64"><Search className="absolute start-2 top-2.5 size-4 text-muted-foreground" /><Input className="ps-8" placeholder={t("بحث باللوحة أو الموظف")} value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        {tab !== "vios" ? (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground"><tr>
              {(tab === "cars" ? ["م", "رقم اللوحة", "نوع السيارة", "الموديل", "الموظف المسؤول", "رقم الموظف", "تاريخ التسليم", "تاريخ الاستلام", "حالة السيارة", ""] : ["م", "رقم اللوحة", "الموظف المسؤول", "تاريخ التسليم", "تاريخ الاستلام", "انتهاء الاستمارة", "انتهاء التأمين", "حالة السيارة", ""]).map((h, i) => <th key={i} className="p-2 text-start font-medium">{t(h)}</th>)}
            </tr></thead>
            <tbody>
              {carList.length === 0 && <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">{t("لا توجد سيارات بعد")}</td></tr>}
              {carList.map((c, i) => (
                <tr key={c.id} className="border-t">
                  <td className="p-2">{i + 1}</td>
                  <td className="p-2 font-medium" dir="ltr">{c.plate}</td>
                  {tab === "cars" ? <>
                    <td className="p-2">{c.car_type}</td><td className="p-2">{c.model_year}</td>
                    <td className="p-2 whitespace-nowrap">{c.employee_name || "—"}</td><td className="p-2">{c.employee_no || "—"}</td>
                    <td className="p-2">{c.handover_date || "—"}</td><td className="p-2">{c.return_date || "—"}</td>
                  </> : <>
                    <td className="p-2 whitespace-nowrap">{c.employee_name || "—"}</td>
                    <td className="p-2">{c.handover_date || "—"}</td><td className="p-2">{c.return_date || "—"}</td>
                    <td className="p-2">{expiryNote(c.registration_expiry)}</td><td className="p-2">{expiryNote(c.insurance_expiry)}</td>
                  </>}
                  <td className="p-2"><Badge s={c.status} map={carCls} /></td>
                  <td className="p-2 print:hidden"><div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setView(c)} aria-label={t("عرض التفاصيل")}><Eye className="size-4" /></Button>
                    {canEdit && <Button size="icon" variant="ghost" onClick={() => setEditCar({ ...c, handover_date: c.handover_date ?? "", return_date: c.return_date ?? "", registration_expiry: c.registration_expiry ?? "", insurance_expiry: c.insurance_expiry ?? "" })}><Pencil className="size-4" /></Button>}
                    {canEdit && <Button size="icon" variant="ghost" onClick={() => del("fleet_cars", c.id)}><Trash2 className="size-4 text-destructive" /></Button>}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground"><tr>
              {["م", "رقم المخالفة", "نوع المخالفة", "رقم اللوحة", "الموظف", "تاريخ المخالفة", "الوقت", "الموقع", "المبلغ", "الحالة", ""].map((h, i) => <th key={i} className="p-2 text-start font-medium">{t(h)}</th>)}
            </tr></thead>
            <tbody>
              {vioList.length === 0 && <tr><td colSpan={11} className="p-6 text-center text-muted-foreground">{t("لا توجد مخالفات")}</td></tr>}
              {vioList.map((v, i) => (
                <tr key={v.id} className="border-t">
                  <td className="p-2">{i + 1}</td><td className="p-2" dir="ltr">{v.violation_no}</td><td className="p-2">{t(v.violation_type)}</td>
                  <td className="p-2" dir="ltr">{v.plate}</td><td className="p-2 whitespace-nowrap">{v.employee_name || "—"}</td>
                  <td className="p-2">{v.violation_date || "—"}</td><td className="p-2">{v.violation_time}</td><td className="p-2">{v.location}</td>
                  <td className="p-2 whitespace-nowrap">{Number(v.amount).toLocaleString()} {t("ريال")}</td>
                  <td className="p-2"><Badge s={v.status} map={vioCls} /></td>
                  <td className="p-2 print:hidden"><div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => notify(v)} title={t("إشعار الموظف بالبريد")}><Mail className="size-4" /></Button>
                    {canEdit && <Button size="icon" variant="ghost" onClick={() => setEditVio({ ...v, violation_date: v.violation_date ?? "" })}><Pencil className="size-4" /></Button>}
                    {canEdit && <Button size="icon" variant="ghost" onClick={() => del("traffic_violations", v.id)}><Trash2 className="size-4 text-destructive" /></Button>}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <section className="grid gap-3 md:grid-cols-4 print:hidden">
        {[[VIO_STATUSES[0], "تم تسجيل المخالفة ولم يتم إشعار الموظف", AlertTriangle], [VIO_STATUSES[1], "تم إرسال إشعار للموظف عبر البريد", Mail], [VIO_STATUSES[2], "تم إشعار الموظف ولم يتم السداد بعد", Clock], [VIO_STATUSES[3], "تم سداد المخالفة وإرفاق الإثبات", CheckCircle2]].map(([s, d, I]) => {
          const Icon = I as typeof Wrench;
          return <div key={s as string} className="flex items-start gap-3 rounded-xl border bg-card p-3"><span className={`rounded-full p-2 ${vioCls[s as string]}`}><Icon className="size-4" /></span><div><div className="font-medium">{t(s as string)} ({vios.filter((v) => v.status === s).length})</div><div className="text-xs text-muted-foreground">{t(d as string)}</div></div></div>;
        })}
      </section>

      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("تفاصيل السيارة")}</DialogTitle></DialogHeader>
          {view && <div className="grid grid-cols-2 gap-3 text-sm">
            {[["رقم اللوحة", view.plate], ["نوع السيارة", view.car_type], ["الموديل", view.model_year], ["حالة السيارة", t(view.status)], ["الموظف المسؤول", view.employee_name], ["رقم الموظف", view.employee_no], ["تاريخ التسليم", view.handover_date], ["تاريخ الاستلام", view.return_date], ["تاريخ انتهاء الاستمارة", view.registration_expiry], ["شركة التأمين", view.insurance_company], ["تاريخ انتهاء التأمين", view.insurance_expiry], ["المخالفات", String(vios.filter((v) => v.plate === view.plate).length)]].map(([l, v]) => (
              <div key={l as string}><div className="text-xs text-muted-foreground">{t(l as string)}</div><div className="font-medium">{v || "—"}</div></div>
            ))}
            {view.notes && <div className="col-span-2"><div className="text-xs text-muted-foreground">{t("ملاحظات")}</div>{view.notes}</div>}
          </div>}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editCar} onOpenChange={(o) => !o && setEditCar(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editCar?.id ? t("تعديل سيارة") : t("إضافة سيارة")}</DialogTitle></DialogHeader>
          {editCar && <div className="grid grid-cols-2 gap-3">
            <F label="رقم اللوحة"><Input dir="ltr" value={editCar.plate} onChange={(e) => setEditCar({ ...editCar, plate: e.target.value })} /></F>
            <F label="نوع السيارة"><Input value={editCar.car_type} onChange={(e) => setEditCar({ ...editCar, car_type: e.target.value })} /></F>
            <F label="الموديل"><Input inputMode="numeric" value={editCar.model_year} onChange={(e) => setEditCar({ ...editCar, model_year: e.target.value })} /></F>
            <F label="حالة السيارة"><select className={sel} value={editCar.status} onChange={(e) => setEditCar({ ...editCar, status: e.target.value })}>{CAR_STATUSES.map((s) => <option key={s} value={s}>{t(s)}</option>)}</select></F>
            <div className="col-span-2"><F label="الموظف المسؤول"><EmpSelect value={editCar.employee_name ? editCar.employee_no + "|" + editCar.employee_name : ""} onChange={(k) => setEditCar(pickEmp(editCar, k))} /></F></div>
            <F label="تاريخ التسليم"><Input type="date" value={editCar.handover_date ?? ""} onChange={(e) => setEditCar({ ...editCar, handover_date: e.target.value })} /></F>
            <F label="تاريخ الاستلام"><Input type="date" value={editCar.return_date ?? ""} onChange={(e) => setEditCar({ ...editCar, return_date: e.target.value })} /></F>
            <F label="تاريخ انتهاء الاستمارة"><Input type="date" value={editCar.registration_expiry ?? ""} onChange={(e) => setEditCar({ ...editCar, registration_expiry: e.target.value })} /></F>
            <F label="تاريخ انتهاء التأمين"><Input type="date" value={editCar.insurance_expiry ?? ""} onChange={(e) => setEditCar({ ...editCar, insurance_expiry: e.target.value })} /></F>
            <div className="col-span-2"><F label="شركة التأمين"><Input value={editCar.insurance_company} onChange={(e) => setEditCar({ ...editCar, insurance_company: e.target.value })} /></F></div>
            <div className="col-span-2"><F label="ملاحظات"><Textarea value={editCar.notes} onChange={(e) => setEditCar({ ...editCar, notes: e.target.value })} /></F></div>
            <Button className="col-span-2" onClick={saveCar}>{t("حفظ")}</Button>
          </div>}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editVio} onOpenChange={(o) => !o && setEditVio(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editVio?.id ? t("تعديل مخالفة") : t("إضافة مخالفة")}</DialogTitle></DialogHeader>
          {editVio && <div className="grid grid-cols-2 gap-3">
            <F label="رقم المخالفة"><Input dir="ltr" value={editVio.violation_no} onChange={(e) => setEditVio({ ...editVio, violation_no: e.target.value })} /></F>
            <F label="نوع المخالفة"><select className={sel} value={editVio.violation_type} onChange={(e) => setEditVio({ ...editVio, violation_type: e.target.value })}>{VIO_TYPES.map((s) => <option key={s} value={s}>{t(s)}</option>)}</select></F>
            <F label="رقم اللوحة"><select className={sel} value={editVio.plate} onChange={(e) => { const c = cars.find((x) => x.plate === e.target.value); setEditVio({ ...editVio, plate: e.target.value, employee_no: c?.employee_no ?? "", employee_name: c?.employee_name ?? "" }); }}><option value="">—</option>{cars.map((c) => <option key={c.id} value={c.plate}>{c.plate}</option>)}</select></F>
            <F label="الموظف"><EmpSelect value={editVio.employee_name ? editVio.employee_no + "|" + editVio.employee_name : ""} onChange={(k) => setEditVio(pickEmp(editVio, k))} /></F>
            <F label="تاريخ المخالفة"><Input type="date" value={editVio.violation_date ?? ""} onChange={(e) => setEditVio({ ...editVio, violation_date: e.target.value })} /></F>
            <F label="الوقت"><Input type="time" value={editVio.violation_time} onChange={(e) => setEditVio({ ...editVio, violation_time: e.target.value })} /></F>
            <F label="الموقع"><Input value={editVio.location} onChange={(e) => setEditVio({ ...editVio, location: e.target.value })} /></F>
            <F label="المبلغ"><Input type="text" inputMode="decimal" dir="ltr" placeholder="0" value={editVio.amount || ""} onChange={(e) => setEditVio({ ...editVio, amount: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 })} /></F>
            <div className="col-span-2"><F label="الحالة"><select className={sel} value={editVio.status} onChange={(e) => setEditVio({ ...editVio, status: e.target.value })}>{VIO_STATUSES.map((s) => <option key={s} value={s}>{t(s)}</option>)}</select></F></div>
            <div className="col-span-2"><F label="ملاحظات"><Textarea value={editVio.notes} onChange={(e) => setEditVio({ ...editVio, notes: e.target.value })} /></F></div>
            <Button className="col-span-2" onClick={saveVio}>{t("حفظ")}</Button>
          </div>}
        </DialogContent>
      </Dialog>
    </main>
  );
}
