import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Pencil, Plus, Search, Trash2, Users, Banknote, FileText, Star } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useCanEditHr } from "@/lib/permissions";
import { t, useLanguage } from "@/lib/i18n";
import { StatCard } from "@/components/ResidenciesPanel";
import { PdfButton } from "@/components/PdfButton";
import { ALERT_DAYS, daysLeft } from "@/lib/residency";
import sheets from "@/lib/hr-sheets.json";
import { contractOptions, resolveEmployeeStatus, statusOptions } from "@/lib/employee-status";
import { NationalitySelect } from "@/components/NationalitySelect";

export const Route = createFileRoute("/establishment")({
  head: () => ({
    meta: [
      { title: "المؤسسة — Metal Fuze" },
      { name: "description", content: "ملف الموارد البشرية للمؤسسة: الموظفون والوثائق والإجازات والرواتب والتقييمات." },
      { property: "og:title", content: "المؤسسة — Metal Fuze" },
      { property: "og:description", content: "بيانات موظفي المؤسسة ووثائقهم ورواتبهم وتقييماتهم." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EstablishmentPage,
});

type Key = "employees" | "documents" | "leaves" | "payroll" | "evaluations";
type Rec = { id: string; sheet: Key; data: Record<string, string | number>; sort: number };
const TABS: Key[] = ["employees", "documents", "leaves", "payroll", "evaluations"];
const S = sheets as Record<Key, { title: string; columns: string[] }>;
const MONEY = ["الراتب الأساسي", "البدلات", "إجمالي الراتب", "الخصومات", "الإضافي", "صافي الراتب"];
const fmt = (v: unknown) => typeof v === "number" ? v.toLocaleString("en-US") : String(v ?? "");

function cols(k: Key) {
  const c = S[k].columns;
  return k === "documents" ? c.filter((x) => x !== "الأيام المتبقية" && x !== "الحالة") : c;
}

const PDF_COLS = 9;
const KEY_COLS = ["رقم الموظف", "اسم الموظف"];
function pdfChunks(all: string[]): string[][] {
  if (all.length <= PDF_COLS + 1) return [all];
  const keys = KEY_COLS.filter((k) => all.includes(k));
  const rest = all.filter((c) => !keys.includes(c));
  const size = PDF_COLS - keys.length;
  const out: string[][] = [];
  for (let i = 0; i < rest.length; i += size) out.push([...keys, ...rest.slice(i, i + size)]);
  return out;
}

function EstablishmentPage() {
  const lang = useLanguage();
  const canEdit = useCanEditHr();
  const [rows, setRows] = useState<Rec[]>([]);
  const [tab, setTab] = useState<Key>("employees");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<{ id?: string; data: Record<string, string | number> } | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("est_records").select("*").order("sort");
    setRows((data ?? []) as Rec[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  const of = (k: Key) => rows.filter((r) => r.sheet === k);
  const list = useMemo(() => of(tab).filter((r) => !q || Object.values(r.data).join(" ").includes(q)), [rows, tab, q]);
  const emps = of("employees");
  const net = of("payroll").reduce((s, r) => s + Number(r.data["صافي الراتب"] || 0), 0);
  const docsSoon = of("documents").filter((r) => { const d = daysLeft(String(r.data["تاريخ الانتهاء"] ?? "")); return d !== null && d <= ALERT_DAYS; }).length;
  const shown = [...cols(tab), ...(tab === "documents" ? ["الأيام المتبقية", "الحالة"] : [])];

  async function save() {
    if (!edit) return;
    const data = { ...edit.data };
    for (const k of MONEY) if (data[k] !== undefined && data[k] !== "") data[k] = Number(data[k]);
    const { error } = edit.id ? await supabase.from("est_records").update({ data }).eq("id", edit.id)
      : await supabase.from("est_records").insert({ sheet: tab, data, sort: of(tab).length });
    if (error) { toast.error(t("تعذر الحفظ")); return; }
    toast.success(t("تم الحفظ")); setEdit(null); load();
  }
  async function remove(id: string) {
    if (!confirm(t("حذف هذا السجل نهائيًا؟"))) return;
    const { error } = await supabase.from("est_records").delete().eq("id", id);
    if (error) { toast.error(t("تعذر الحذف")); return; }
    load();
  }

  function cell(r: Rec, c: string) {
    if (tab === "documents" && (c === "الأيام المتبقية" || c === "الحالة")) {
      const d = daysLeft(String(r.data["تاريخ الانتهاء"] ?? ""));
      if (c === "الأيام المتبقية") return d ?? "—";
      const [label, cls] = d === null ? ["غير محدد", "bg-muted text-muted-foreground"] : d < 0 ? ["منتهية", "bg-destructive/15 text-destructive"]
        : d <= ALERT_DAYS ? ["قرب الانتهاء", "bg-warning/15 text-warning"] : ["سارية", "bg-success/15 text-success"];
      return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{t(label)}</span>;
    }
      if (c === "اسم الموظف") {
        const st = statusLabel(r.data["حالة الموظف"] ?? r.data["الحالة"], lang);
        if (st) return <span>{fmt(r.data[c]) || "—"} <span className="ms-1 inline-block rounded-full bg-destructive px-2 py-0.5 text-[10px] font-semibold text-destructive-foreground">{st}</span></span>;
      }
    return fmt(r.data[c]) || "—";
  }

  return (
    <main className="mx-auto max-w-7xl space-y-5 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Building2 className="size-6 text-primary" /> {t("المؤسسة")}</h1>
          <p className="text-sm text-muted-foreground">{t("ملف الموارد البشرية الخاص بالمؤسسة")}</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <PdfButton />
          {canEdit && <Button onClick={() => setEdit({ data: {} })}><Plus /> {t("إضافة سجل")}</Button>}
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label={t("إجمالي الموظفين")} value={emps.length} icon={<Users className="size-5 text-primary" />} cls="border-border bg-card" />
        <StatCard label={t("على رأس العمل")} value={emps.filter((r) => r.data["حالة الموظف"] === "على رأس العمل").length} icon={<Users className="size-5 text-success" />} cls="border-success/40 bg-success/10" />
        <StatCard label={t("وثائق قرب الانتهاء أو منتهية")} value={docsSoon} icon={<FileText className="size-5 text-warning" />} cls="border-warning/40 bg-warning/10" />
        <StatCard label={t("صافي الرواتب")} value={net} icon={<Banknote className="size-5 text-primary" />} cls="border-border bg-card" />
      </section>

      <div className="flex flex-wrap gap-2 print:hidden">
        {TABS.map((k) => (
          <Button key={k} variant={tab === k ? "default" : "outline"} size="sm" onClick={() => setTab(k)}>
            {k === "evaluations" && <Star />}{t(S[k].title)} <span className="opacity-70">({of(k).length})</span>
          </Button>
        ))}
        <div className="relative ms-auto min-w-56">
          <Search className="absolute start-2 top-2.5 size-4 text-muted-foreground" />
          <Input className="ps-8" placeholder={t("بحث")} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {/* PDF layout: wide sheets split into tables of a few columns, each repeating number + name. */}
      <div className="hidden space-y-4 print:block">
        <h2 className="text-lg font-bold">{t(S[tab].title)} <span className="text-sm font-normal">({list.length})</span></h2>
        {pdfChunks(shown).map((group, gi) => (
          <table key={gi} className="w-full border-collapse text-xs">
            <thead><tr>{group.map((c) => <th key={c} className="border p-1.5 text-start">{t(c)}</th>)}</tr></thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id}>{group.map((c) => <td key={c} className="border p-1.5 align-top">{cell(r, c)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card print:hidden">
        <table className="w-full whitespace-nowrap text-sm">
          <thead className="bg-muted/50">
            <tr>{shown.map((c) => <th key={c} className="p-2 text-start font-semibold">{t(c)}</th>)}{canEdit && <th className="print:hidden" />}</tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id} className={`border-t ${tab === "employees" && statusLabel(r.data["حالة الموظف"] ?? r.data["الحالة"], lang) ? "bg-destructive/10" : ""}`}>
                {shown.map((c) => <td key={c} className="p-2">{cell(r, c)}</td>)}
                {canEdit && <td className="p-2 print:hidden"><div className="flex gap-1">
                  <Button size="icon" variant="ghost" aria-label={t("تعديل")} onClick={() => setEdit({ id: r.id, data: { ...r.data } })}><Pencil /></Button>
                  <Button size="icon" variant="ghost" className="text-destructive" aria-label={t("حذف")} onClick={() => remove(r.id)}><Trash2 /></Button>
                </div></td>}
              </tr>
            ))}
            {!list.length && <tr><td colSpan={shown.length + 1} className="p-6 text-center text-muted-foreground">{t("لا توجد سجلات")}</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t(S[tab].title)}</DialogTitle></DialogHeader>
          {edit && <div className="grid gap-3 sm:grid-cols-2">
            {cols(tab).map((c) => (
              <label key={c} className="grid gap-1 text-sm">{t(c)}
                {(() => {
                  const val = String(edit.data[c] ?? "");
                  const set = (v: string) => setEdit({ ...edit, data: { ...edit.data, [c]: v } });
                  const opts = tab === "employees" && c === "حالة الموظف" ? statusOptions(lang)
                    : c === "نوع العقد" ? contractOptions(lang) : null;
                  if (tab === "employees" && c === "الجنسية") return <NationalitySelect value={val} onChange={set} />;
                  if (opts) {
                    const cur = c === "حالة الموظف" ? (resolveEmployeeStatus(val)?.ar ?? val) : val;
                    return (
                      <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground" value={cur} onChange={(e) => set(e.target.value)}>
                        <option value="">{lang === "en" ? "Select" : "اختر"}</option>
                        {cur && !opts.some((o) => o.value === cur) && <option value={cur}>{cur}</option>}
                        {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    );
                  }
                  return <Input type={c.startsWith("تاريخ") && c !== "تاريخ الميلاد" ? "date" : MONEY.includes(c) ? "number" : "text"} value={val} onChange={(e) => set(e.target.value)} />;
                })()}
              </label>
            ))}
            <Button className="sm:col-span-2" onClick={save}>{t("حفظ")}</Button>
          </div>}
        </DialogContent>
      </Dialog>
    </main>
  );
}
