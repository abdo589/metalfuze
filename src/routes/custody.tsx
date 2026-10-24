import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Box, CheckCircle2, ChevronLeft, History, Laptop, Pencil, Plus, RotateCcw, Search, Trash2, Users, Wrench, X } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { EmployeeSignature } from "@/components/EmployeeSignature";
import { useCanEdit } from "@/lib/permissions";
import { t, useLanguage, locale } from "@/lib/i18n";
import { OtherSelect } from "@/components/OtherSelect";

export const Route = createFileRoute("/custody")({
  head: () => ({
    meta: [
      { title: "عهد الأجهزة — Metal Fuze" },
      { name: "description", content: "إدارة أجهزة الشركة وتسليمها للموظفين ومتابعة حركات العهد." },
      { property: "og:title", content: "عهد الأجهزة — Metal Fuze" },
      { property: "og:description", content: "أجهزة الشركة، التسليم والإرجاع، وسجل الحركات." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CustodyPage,
});

type Asset = { id: string; name: string; brand: string; model: string; category: string; serial_no: string; asset_no: string; specs: string; status: string; employee_no: string; employee_name: string; dept: string; handover_date: string | null; confirmed: boolean; notes: string };
type Move = { id: string; asset_id: string; action: string; employee_name: string; employee_no: string; note: string; move_date: string; created_at: string };
type Emp = { no: string; name: string; dept: string };

const STATUSES = ["مسلم", "متاح", "صيانة", "خارج الخدمة"];
const CATS = ["لابتوب", "جوال", "شاشة", "طابعة", "تابلت", "أخرى"];
const cls: Record<string, string> = { "مسلم": "bg-success/15 text-success", "متاح": "bg-primary/15 text-primary", "صيانة": "bg-warning/15 text-warning", "خارج الخدمة": "bg-destructive/15 text-destructive" };
const empty = (): Omit<Asset, "id"> & { id?: string } => ({ name: "", brand: "", model: "", category: CATS[0]!, serial_no: "", asset_no: "", specs: "", status: "متاح", employee_no: "", employee_name: "", dept: "", handover_date: "", confirmed: false, notes: "" });
const sel = "h-9 w-full rounded-md border bg-background px-2 text-sm";
const today = () => new Date().toISOString().slice(0, 10);
const F = ({ label, children }: { label: string; children: React.ReactNode }) => <label className="space-y-1 text-sm"><span className="text-muted-foreground">{t(label)}</span>{children}</label>;
const Badge = ({ s }: { s: string }) => <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${cls[s] ?? "bg-muted"}`}>● {t(s)}</span>;

function CustodyPage() {
  useLanguage();
  const canEdit = useCanEdit();
  const [tab, setTab] = useState<"all" | "current" | "moves">("all");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [moves, setMoves] = useState<Move[]>([]);
  const [emps, setEmps] = useState<Emp[]>([]);
  const [q, setQ] = useState("");
  const [fs, setFs] = useState("");
  const [fd, setFd] = useState("");
  const [edit, setEdit] = useState<ReturnType<typeof empty> | null>(null);
  const [hand, setHand] = useState<{ asset_id: string; emp: string; date: string; note: string } | null>(null);
  const [view, setView] = useState<Asset | null>(null);

  const load = useCallback(async () => {
    const [a, m, e] = await Promise.all([
      supabase.from("custody_assets").select("*").order("created_at"),
      supabase.from("custody_moves").select("*").order("created_at", { ascending: false }),
      supabase.from("hr_records").select("data").eq("sheet", "employees").order("sort"),
    ]);
    const list = (a.data ?? []) as Asset[];
    setAssets(list); setMoves((m.data ?? []) as Move[]);
    setView((v) => (v ? list.find((x) => x.id === v.id) ?? null : v));
    const seen = new Set<string>();
    setEmps(((e.data ?? []) as { data: Record<string, unknown> }[]).map(({ data: d }) => ({ no: String(d["رقم الموظف"] ?? "").trim(), name: String(d["اسم الموظف"] ?? "").trim(), dept: String(d["القسم"] ?? d["الإدارة"] ?? "").trim() }))
      .filter((x) => x.name && !seen.has(x.no + x.name) && seen.add(x.no + x.name)));
  }, []);
  useEffect(() => { void load(); }, [load]);

  const depts = [...new Set(assets.map((a) => a.dept).filter(Boolean))];
  const list = assets.filter((a) => (tab !== "current" || a.status === "مسلم") && (!fs || a.status === fs) && (!fd || a.dept === fd) &&
    (!q || `${a.name} ${a.brand} ${a.serial_no} ${a.employee_name} ${a.employee_no}`.toLowerCase().includes(q.toLowerCase())));
  const n = (s: string) => assets.filter((a) => a.status === s).length;
  const log = (asset_id: string, action: string, a: Partial<Asset>, note = "", move_date = today()) =>
    supabase.from("custody_moves").insert({ asset_id, action, employee_name: a.employee_name ?? "", employee_no: a.employee_no ?? "", note, move_date });

  async function save() {
    if (!edit?.name.trim()) { toast.error(t("اسم الجهاز مطلوب")); return; }
    const { id, ...row } = edit;
    const payload = { ...row, handover_date: row.handover_date || null };
    const r = id ? await supabase.from("custody_assets").update(payload).eq("id", id) : await supabase.from("custody_assets").insert(payload).select("id").single();
    if (r.error) { toast.error(t("تعذر الحفظ")); return; }
    if (!id && r.data) await log((r.data as { id: string }).id, "إضافة جهاز", {});
    toast.success(t("تم الحفظ")); setEdit(null); void load();
  }
  async function handover() {
    if (!hand) return;
    const e = emps.find((x) => x.no + "|" + x.name === hand.emp);
    if (!hand.asset_id || !e) { toast.error(t("اختر الجهاز والموظف")); return; }
    const patch = { status: "مسلم", employee_no: e.no, employee_name: e.name, dept: e.dept, handover_date: hand.date, confirmed: true };
    const { error } = await supabase.from("custody_assets").update(patch).eq("id", hand.asset_id);
    if (error) { toast.error(t("تعذر الحفظ")); return; }
    await log(hand.asset_id, "تسليم", patch, hand.note, hand.date);
    toast.success(t("تم تسليم العهدة")); setHand(null); void load();
  }
  async function giveBack(a: Asset) {
    if (!confirm(`${t("تسجيل إرجاع")} ${a.name}?`)) return;
    await supabase.from("custody_assets").update({ status: "متاح", employee_no: "", employee_name: "", dept: "", handover_date: null, confirmed: false }).eq("id", a.id);
    await log(a.id, "إرجاع", a); toast.success(t("تم تسجيل الإرجاع")); void load();
  }
  async function remove(a: Asset) {
    if (!confirm(`${t("حذف")} ${a.name}?`)) return;
    await supabase.from("custody_assets").delete().eq("id", a.id); setView(null); void load();
  }
  const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString(locale()) : "-");

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 pb-72 sm:px-6">
      <div className="flex flex-wrap items-start gap-3">
        <div className="rounded-xl bg-primary/10 p-3 text-primary"><Laptop /></div>
        <div><h1 className="font-display text-2xl font-extrabold">{t("عهد الأجهزة")}</h1><p className="text-sm text-muted-foreground">{t("إدارة أجهزة الشركة وتسليمها للموظفين")}</p></div>
        {canEdit && <div className="ms-auto flex gap-2">
          <Button variant="outline" onClick={() => setEdit(empty())}><Plus /> {t("إضافة جهاز")}</Button>
          <Button onClick={() => setHand({ asset_id: "", emp: "", date: today(), note: "" })}><Plus /> {t("تسليم عهدة")}</Button>
        </div>}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {([["إجمالي الأجهزة", assets.length, "جهاز في النظام", Laptop, "bg-primary/10 text-primary"], ["بعهدة الموظفين", n("مسلم"), "جهاز مُسلّم", Users, "bg-success/10 text-success"], ["متاح للتسليم", n("متاح"), "جهاز متاح", Box, "bg-primary/10 text-primary"], ["تحت الصيانة", n("صيانة"), "جهاز تحت الصيانة", Wrench, "bg-warning/10 text-warning"]] as const).map(([k, v, s, I, c]) => (
          <div key={k} className="flex items-center gap-4 rounded-2xl border bg-card p-5">
            <div className={`rounded-xl p-3 ${c}`}><I /></div>
            <div><div className="font-semibold">{t(k)}</div><div className="text-2xl font-bold">{v}</div><div className="text-xs text-muted-foreground">{t(s)}</div></div>
          </div>
        ))}
      </div>

      <div className="flex gap-1 border-b">
        {([["all", "كل الأجهزة"], ["current", "العُهد الحالية"], ["moves", "سجل الحركات"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`border-b-2 px-4 py-2 text-sm font-semibold ${tab === k ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>{t(l)}</button>
        ))}
      </div>

      {tab !== "moves" ? <>
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-60 flex-1"><Search className="absolute start-3 top-2.5 size-4 text-muted-foreground" /><Input className="ps-9" placeholder={t("البحث في الأجهزة أو الرقم التسلسلي أو اسم الموظف...")} value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <select className={`${sel} w-40`} value={fs} onChange={(e) => setFs(e.target.value)}><option value="">{t("كل الحالات")}</option>{STATUSES.map((s) => <option key={s} value={s}>{t(s)}</option>)}</select>
          <select className={`${sel} w-40`} value={fd} onChange={(e) => setFd(e.target.value)}><option value="">{t("كل الأقسام")}</option>{depts.map((s) => <option key={s}>{s}</option>)}</select>
          <Button variant="outline" onClick={() => { setQ(""); setFs(""); setFd(""); }}><RotateCcw /> {t("إعادة تعيين")}</Button>
        </div>
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground"><tr>{["الجهاز", "الرقم التسلسلي", "الموظف", "القسم", "تاريخ التسليم", "الحالة", ""].map((h) => <th key={h} className="p-3 text-start">{t(h)}</th>)}</tr></thead>
            <tbody>
              {!list.length && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">{t("لا توجد أجهزة")}</td></tr>}
              {list.map((a) => (
                <tr key={a.id} onClick={() => setView(a)} className={`cursor-pointer border-t hover:bg-muted/50 ${view?.id === a.id ? "bg-primary/5" : ""}`}>
                  <td className="p-3"><div className="font-semibold">{a.name}</div><div className="text-xs text-muted-foreground">{a.brand}</div></td>
                  <td className="p-3" dir="ltr">{a.serial_no || "-"}</td>
                  <td className="p-3"><div className="font-medium">{a.employee_name || "-"}</div><div className="text-xs text-muted-foreground">{a.employee_no}</div></td>
                  <td className="p-3">{a.dept || "-"}</td>
                  <td className="p-3">{fmt(a.handover_date)}</td>
                  <td className="p-3"><Badge s={a.status} /></td>
                  <td className="p-3"><ChevronLeft className="size-4 text-muted-foreground rtl:rotate-0 ltr:rotate-180" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </> : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground"><tr>{["التاريخ", "الجهاز", "العملية", "الموظف", "ملاحظة"].map((h) => <th key={h} className="p-3 text-start">{t(h)}</th>)}</tr></thead>
            <tbody>
              {!moves.length && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">{t("لا توجد حركات بعد")}</td></tr>}
              {moves.map((m) => (
                <tr key={m.id} className="border-t">
                  <td className="p-3">{fmt(m.move_date)}</td>
                  <td className="p-3">{assets.find((a) => a.id === m.asset_id)?.name ?? "-"}</td>
                  <td className="p-3 font-semibold">{t(m.action)}</td>
                  <td className="p-3">{m.employee_name || "-"} <span className="text-xs text-muted-foreground">{m.employee_no}</span></td>
                  <td className="p-3" dir="auto">{m.note || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-card p-4 shadow-2xl md:start-64">
          <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[1fr_2fr_auto]">
            <div className="space-y-2">
              <div className="flex items-start gap-2"><Button size="icon" variant="ghost" onClick={() => setView(null)} aria-label={t("إغلاق")}><X /></Button>
                <div><div className="text-lg font-bold">{view.name}</div><div className="text-sm text-muted-foreground">{view.brand}</div>
                  <div className="mt-1 flex flex-wrap gap-1">{[view.category, view.specs].filter(Boolean).map((x) => <span key={x} className="rounded-md bg-muted px-2 py-0.5 text-xs">{t(x)}</span>)}</div></div></div>
              {view.status === "مسلم" && view.confirmed && <div className="flex items-center gap-2 rounded-xl border border-success/40 bg-success/10 p-3 text-sm"><CheckCircle2 className="text-success" /><div><b>{t("تم تأكيد الاستلام")}</b><div className="text-xs text-muted-foreground">{t("تم استلام الجهاز من قبل الموظف في")} {fmt(view.handover_date)}</div></div></div>}
            </div>
            <div className="space-y-3">
              <h3 className="font-bold">{t("تفاصيل العهدة")}</h3>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div><div className="text-muted-foreground">{t("الموظف")}</div><b>{view.employee_name || "-"}</b><div className="text-xs text-muted-foreground">{view.employee_no}</div></div>
                <div><div className="text-muted-foreground">{t("القسم")}</div><b>{view.dept || "-"}</b></div>
                <div><div className="text-muted-foreground">{t("تاريخ التسليم")}</div><b>{fmt(view.handover_date)}</b></div>
              </div>
              <div className="grid grid-cols-2 gap-3 rounded-xl bg-muted p-3 text-sm sm:grid-cols-4">
                {([["الشركة المصنعة", view.brand], ["الموديل", view.model], ["رقم الأصل", view.asset_no], ["الرقم التسلسلي", view.serial_no]] as const).map(([k, v]) => <div key={k}><div className="text-xs text-muted-foreground">{t(k)}</div><b dir="ltr">{v || "-"}</b></div>)}
              </div>
            </div>
            {view.employee_name && <EmployeeSignature empId={view.employee_no} name={view.employee_name} />}
            <div className="flex flex-col gap-2">
              {canEdit && view.status === "مسلم" && <Button onClick={() => giveBack(view)}><RotateCcw /> {t("تسجيل إرجاع")}</Button>}
              {canEdit && view.status !== "مسلم" && <Button onClick={() => setHand({ asset_id: view.id, emp: "", date: today(), note: "" })}><Plus /> {t("تسليم عهدة")}</Button>}
              {canEdit && <Button variant="outline" onClick={() => setEdit({ ...view, handover_date: view.handover_date ?? "" })}><Pencil /> {t("تعديل بيانات العهدة")}</Button>}
              <Button variant="outline" onClick={() => setTab("moves")}><History /> {t("عرض سجل الحركات")}</Button>
              {canEdit && <Button variant="ghost" className="text-destructive" onClick={() => remove(view)}><Trash2 /> {t("حذف")}</Button>}
            </div>
          </div>
        </div>
      )}

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{t(edit?.id ? "تعديل بيانات العهدة" : "إضافة جهاز")}</DialogTitle></DialogHeader>
          {edit && <div className="grid gap-3 sm:grid-cols-2">
            <F label="اسم الجهاز"><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></F>
            <F label="الشركة المصنعة"><Input value={edit.brand} onChange={(e) => setEdit({ ...edit, brand: e.target.value })} /></F>
            <F label="الموديل"><Input value={edit.model} onChange={(e) => setEdit({ ...edit, model: e.target.value })} /></F>
            <F label="النوع"><OtherSelect list="custody_category" base={CATS} value={edit.category} onChange={(v) => setEdit({ ...edit, category: v })} /></F>
            <F label="الرقم التسلسلي"><Input dir="ltr" value={edit.serial_no} onChange={(e) => setEdit({ ...edit, serial_no: e.target.value })} /></F>
            <F label="رقم الأصل"><Input dir="ltr" value={edit.asset_no} onChange={(e) => setEdit({ ...edit, asset_no: e.target.value })} /></F>
            <F label="المواصفات (مثل 14 بوصة)"><Input value={edit.specs} onChange={(e) => setEdit({ ...edit, specs: e.target.value })} /></F>
            <F label="الحالة"><select className={sel} value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>{STATUSES.map((s) => <option key={s} value={s}>{t(s)}</option>)}</select></F>
            <div className="sm:col-span-2"><F label="ملاحظات"><Textarea value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></F></div>
            <Button className="sm:col-span-2" onClick={save}>{t("حفظ")}</Button>
          </div>}
        </DialogContent>
      </Dialog>

      <Dialog open={!!hand} onOpenChange={(o) => !o && setHand(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("تسليم عهدة")}</DialogTitle></DialogHeader>
          {hand && <div className="grid gap-3">
            <F label="الجهاز"><select className={sel} value={hand.asset_id} onChange={(e) => setHand({ ...hand, asset_id: e.target.value })}>
              <option value="">{t("اختر")}</option>{assets.filter((a) => a.status !== "مسلم").map((a) => <option key={a.id} value={a.id}>{a.name} {a.serial_no && `— ${a.serial_no}`}</option>)}</select></F>
            <F label="الموظف"><select className={sel} value={hand.emp} onChange={(e) => setHand({ ...hand, emp: e.target.value })}>
              <option value="">{t("اختر")}</option>{emps.map((e) => <option key={e.no + e.name} value={e.no + "|" + e.name}>{e.name} {e.no && `(${e.no})`}</option>)}</select></F>
            <F label="تاريخ التسليم"><Input type="date" value={hand.date} onChange={(e) => setHand({ ...hand, date: e.target.value })} /></F>
            <F label="ملاحظة"><Input value={hand.note} onChange={(e) => setHand({ ...hand, note: e.target.value })} /></F>
            <Button onClick={handover}>{t("تسليم")}</Button>
          </div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
