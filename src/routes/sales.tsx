import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Coins, Download, Eye, Link2, Pencil, Plus, Trash2 } from "lucide-react";
import { pullLinkFile } from "@/lib/link-file.functions";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { t, useLanguage, locale } from "@/lib/i18n";
import { useRole } from "@/lib/permissions";
import { commissionDue } from "@/lib/sales";
import { OtherSelect } from "@/components/OtherSelect";

export const Route = createFileRoute("/sales")({
  head: () => ({ meta: [
    { title: "المبيعات — Metal Fuze" },
    { name: "description", content: "سجل العملاء وعروض الأسعار والعقود وعمولة المبيعات 2%." },
    { property: "og:title", content: "المبيعات — Metal Fuze" },
    { property: "og:description", content: "سجل العملاء وعروض الأسعار والعقود وعمولة المبيعات." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: SalesPage,
});

const STAGES = ["تسعير", "تم تقديم العرض", "فاز", "خسر"];
const PAYOUT = ["لم تُستحق", "مستحقة", "مصروفة"];
// Approval chain: sales → Eilaf review → Haitham pricing → Eilaf quotation → Haitham approval → CEO → back to Hala & Eilaf.
const WF: { k: string; l: string; email?: string }[] = [
  { k: "sales_entry", l: "بيانات التسعير من المبيعات" },
  { k: "eilaf_review", l: "مراجعة وموافقة Eilaf", email: "eilaf@metalfuze.local" },
  { k: "haitham_pricing", l: "التسعير — Haitham", email: "haitham@metalfuze.local" },
  { k: "eilaf_quotation", l: "عرض السعر — Eilaf", email: "eilaf@metalfuze.local" },
  { k: "haitham_approval", l: "التعميد — Haitham", email: "haitham@metalfuze.local" },
  { k: "ceo_approval", l: "موافقة وتعميد CEO", email: "ceo@metalfuze.local" },
  { k: "done", l: "مكتمل — المبيعات و Eilaf" },
];
const wfLabel = (k: string) => WF.find((s) => s.k === k)?.l ?? k;
type LogE = { at: string; by: string; from: string; to: string; action: string; note: string };
type D = Tables<"sales_deals">;
type Req = Record<string, string | string[]>;
type F = { k: string; l: string; req?: boolean; opts?: string[]; multi?: boolean; hint?: string; long?: boolean; link?: boolean };
// Questions of the "طلب تسعيرة مشروع جديد" pricing-request form, built into the site.
const REQUEST_FORM: { title: string; fields: F[] }[] = [
  { title: "بيانات موظف المبيعات", fields: [
    { k: "sales_name", l: "اسم موظف المبيعات", req: true, opts: ["هالة الخميسي", "نجلاء عساف", "أخرى"] },
    { k: "sales_email", l: "البريد الإلكتروني لموظف المبيعات", req: true },
    { k: "work_type", l: "نوع الأعمال", req: true, opts: ["أعمال العظم", "أعمال التشطيب", "أعمال الإيبوكسي", "أعمال الخشبيات", "أعمال اللوحات", "أعمال متعددة التخصصات"] },
  ] },
  { title: "بيانات العميل", fields: [
    { k: "contact_name", l: "اسم مسؤول التواصل", req: true },
    { k: "contact_title", l: "المسمى الوظيفي لمسؤول التواصل", req: true, opts: ["مالك", "مدير عام", "مدير مشروع", "مهندس مشروع", "مهندس موقع", "مدير مشتريات", "مهندس مشتريات", "أخرى"] },
    { k: "contact_phone", l: "رقم جوال مسؤول التواصل", req: true },
    { k: "contact_email", l: "البريد الإلكتروني لمسؤول التواصل", req: true },
    { k: "client_capacity", l: "صفة جهة العميل", req: true, opts: ["مالك المشروع", "مقاول رئيسي", "مقاول من الباطن", "استشاري", "أخرى"] },
  ] },
  { title: "بيانات المشروع", fields: [
    { k: "in_riyadh", l: "هل المشروع داخل مدينة الرياض؟", opts: ["نعم", "لا"] },
    { k: "scope", l: "وصف مختصر لنطاق العمل المطلوب", req: true, long: true },
    { k: "project_state", l: "حالة المشروع الحالية", req: true, multi: true, opts: ["لم يبدأ", "تحت التنفيذ", "قائم ويحتاج تجديدًا"] },
    { k: "start_time", l: "موعد بدء التنفيذ المتوقع", req: true, opts: ["فوري", "خلال شهر", "خلال 1-3 أشهر", "أكثر من 3 أشهر", "غير محدد"] },
    { k: "has_consultant", l: "هل يوجد استشاري للمشروع؟", opts: ["نعم", "لا", "غير معروف"] },
  ] },
  { title: "بيانات طلب التسعير والمستندات", fields: [
    { k: "pricing_type", l: "نوع التسعيرة", req: true, opts: ["تسعيرة مبدئية", "تسعيرة تفصيلية", "مناقصة"] },
    { k: "has_docs", l: "هل توجد مستندات للمشروع؟", opts: ["نعم", "لا"] },
    { k: "budget_mentioned", l: "هل ذكر العميل ميزانية أو سعرًا متوقعًا للمشروع؟", req: true, opts: ["نعم", "لا"] },
    { k: "budget", l: "الميزانية أو النطاق السعري المتوقع من العميل (ريال سعودي)", hint: "يُعبأ فقط إذا ذكر العميل مبلغًا محددًا أو نطاقًا تقريبيًا، ولا يُكتب أي رقم غير مؤكد." },
    { k: "link_url", l: "رابط المشروع", link: true, hint: "الصق رابطًا خارجيًا: مجلد Google Drive، ملف، صور المشروع، أو أي صفحة مطلوبة للتسعير." },
  ] },
];
const blank = (): Partial<D> => ({ client: "", project: "", client_type: "جديد", shared: false, partner_name: "", my_share: 100, quote_value: 0, contract_value: 0, collected: 0, commission_rate: 2, payout_status: "لم تُستحق", stage: "تسعير", notes: "", request: {} });
const missing = (e: Partial<D>) => {
  const r = (e.request ?? {}) as Req;
  if (!e.client?.trim() || !e.project?.trim()) return true;
  return REQUEST_FORM.some((s) => s.fields.some((f) => f.req && (Array.isArray(r[f.k]) ? !(r[f.k] as string[]).length : !String(r[f.k] ?? "").trim())));
};
const fmt = (n: number) => Math.round(n).toLocaleString(locale());
/** Open a pasted link even when the user forgot "https://". */
const href = (s: string) => (/^https?:\/\//i.test(s) ? s : `https://${s}`);

function SalesPage() {
  useLanguage();
  const role = useRole();
  const canEdit = role === "sales";
  const [rows, setRows] = useState<D[]>([]);
  const [edit, setEdit] = useState<Partial<D> | null>(null);
  const [mode, setMode] = useState<"pricing" | "commission">("pricing");
  const [myEmp, setMyEmp] = useState<string | null>(null);
  const now = new Date();
  const [period, setPeriod] = useState<"month" | "quarter" | "year">("month");

  const load = useCallback(async () => {
    const { data } = await supabase.from("sales_deals").select("*").order("created_at", { ascending: false });
    setRows(data ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);
  const [me, setMe] = useState<{ id: string; email: string } | null>(null);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => {
    if (!data.user) return;
    setMe({ id: data.user.id, email: data.user.email ?? "" });
    supabase.from("profiles").select("employee_id").eq("id", data.user.id).maybeSingle().then(({ data: p }) => setMyEmp(p?.employee_id ?? null));
  }); }, []);
  const myTurn = (d: D) => !!me && (d.workflow_step === "sales_entry" ? d.owner_id === me.id && canEdit : WF.find((s) => s.k === d.workflow_step)?.email === me.email);
  const [wfNote, setWfNote] = useState(""); const [wfPrice, setWfPrice] = useState(""); const [wfFile, setWfFile] = useState<File | null>(null); const [wfBusy, setWfBusy] = useState(false);
  async function advance(d: D, action: "approve" | "reject") {
    setWfBusy(true);
    let path: string | null = null, name: string | null = null;
    if (action === "approve" && wfFile && me) {
      path = `${me.id}/${Date.now()}_${wfFile.name.replace(/[^\w.\-\u0600-\u06FF]/g, "_")}`; name = wfFile.name;
      const { error } = await supabase.storage.from("sales-files").upload(path, wfFile);
      if (error) { toast.error(t("تعذر رفع الملف")); setWfBusy(false); return; }
    }
    const { error } = await supabase.rpc("sales_advance", { p_id: d.id, p_action: action, p_note: wfNote, ...(wfPrice ? { p_price: Number(wfPrice) } : {}), ...(path && name ? { p_file_path: path, p_file_name: name } : {}) });
    setWfBusy(false);
    if (error) { toast.error(t("تعذر الحفظ، حاول مرة أخرى")); return; }
    toast.success(t("تم الإرسال للمرحلة التالية")); setWfNote(""); setWfPrice(""); setWfFile(null); setView(null); load();
  }

  const inPeriod = (d: D) => {
    const c = new Date(d.created_at);
    if (c.getFullYear() !== now.getFullYear()) return false;
    if (period === "year") return true;
    if (period === "quarter") return Math.floor(c.getMonth() / 3) === Math.floor(now.getMonth() / 3);
    return c.getMonth() === now.getMonth();
  };
  const stats = useMemo(() => {
    const p = rows.filter(inPeriod);
    return {
      contracts: p.reduce((s, d) => s + Number(d.contract_value), 0),
      collected: p.reduce((s, d) => s + Number(d.collected), 0),
      due: p.reduce((s, d) => s + commissionDue(d), 0),
      paid: p.filter((d) => d.payout_status === "مصروفة").reduce((s, d) => s + commissionDue(d), 0),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, period]);

  const perEmp = useMemo(() => {
    const m = new Map<string, { n: number; won: number; contracts: number; collected: number; due: number; paid: number }>();
    for (const d of rows.filter(inPeriod)) {
      const name = String(((d.request ?? {}) as Req)["sales_name"] ?? "").trim() || "Hala Alkhamisy";
      const e = m.get(name) ?? { n: 0, won: 0, contracts: 0, collected: 0, due: 0, paid: 0 };
      e.n++; if (d.stage === "فاز") e.won++;
      e.contracts += Number(d.contract_value); e.collected += Number(d.collected);
      const c = commissionDue(d); e.due += c; if (d.payout_status === "مصروفة") e.paid += c;
      m.set(name, e);
    }
    return [...m.entries()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, period]);

  // Unsaved form answers (request fields only) survive closing the dialog or leaving the page.
  // Only the user's typed request answers are kept — never workflow/pricing/stage columns — and
  // only after an actual edit, so reopening never rolls back changes made by others.
  const draftKey = (id?: string) => `sales-draft:${id ?? "new"}`;
  const dirty = useRef(false);
  const openDraft = (base: Partial<D>) => {
    dirty.current = false;
    try {
      const d = localStorage.getItem(draftKey(base.id));
      const saved = d ? (JSON.parse(d) as { request?: Req }) : null;
      setEdit(saved?.request && typeof saved.request === "object"
        ? { ...base, request: { ...((base.request ?? {}) as Req), ...saved.request } }
        : base);
    } catch { setEdit(base); }
  };
  useEffect(() => {
    if (!edit || mode !== "pricing" || !dirty.current) return;
    try { localStorage.setItem(draftKey(edit.id), JSON.stringify({ request: edit.request ?? {} })); } catch { /* storage full */ }
  }, [edit, mode]);
  async function save(): Promise<void> {
    if (!edit) return;
    const { id, created_at: _c, owner_id: _o, ...rest } = edit as D;
    const req = { ...((rest.request ?? {}) as Req), ...(myEmp ? { owner_emp: myEmp } : {}) };
    const payload = { ...rest, request: req, updated_at: new Date().toISOString() };
    const { error } = id ? await supabase.from("sales_deals").update(payload).eq("id", id) : await supabase.from("sales_deals").insert(payload);
    if (error) { toast.error(t("تعذر الحفظ، حاول مرة أخرى")); return; }
    try { localStorage.removeItem(draftKey(id)); } catch { /* ignore */ }
    toast.success(t("تم الحفظ")); setEdit(null); load();
  }
  async function remove(d: D) { };
    if (!confirm(t("حذف؟"))) return;
    await supabase.from("sales_deals").delete().eq("id", d.id); load();
  }
  const set = <K extends keyof D>(k: K, v: D[K]) => setEdit((e) => ({ ...e, [k]: v }));
  const num = (k: "quote_value" | "contract_value" | "collected" | "my_share" | "commission_rate", label: string) => (
    <div className="space-y-1.5"><Label>{label}</Label>
      <Input type="text" inputMode="decimal" dir="ltr" placeholder="0" value={String(edit?.[k] ?? "")}
        onChange={(e) => set(k, Number(e.target.value.replace(/[^\d.]/g, "")) as never)} /></div>
  );
  const setR = (k: string, v: string | string[]) => setEdit((e) => ({ ...e, request: { ...((e?.request ?? {}) as Req), [k]: v } }));
  const field = (f: F) => {
    const r = (edit?.request ?? {}) as Req; const v = r[f.k];
    const lab = <Label>{t(f.l)}{f.req && <span className="text-destructive"> *</span>}</Label>;
    if (f.multi) return <div key={f.k} className="space-y-1.5 sm:col-span-2">{lab}<div className="flex flex-wrap gap-4">{f.opts!.map((o) => {
      const arr = Array.isArray(v) ? v : []; return <label key={o} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={arr.includes(o)} onChange={(e) => setR(f.k, e.target.checked ? [...arr, o] : arr.filter((x) => x !== o))} />{t(o)}</label>; })}</div></div>;
    if (f.opts) return <div key={f.k} className="space-y-1.5">{lab}{f.opts.includes("أخرى")
      ? <OtherSelect list={`sales_${f.k}`} base={f.opts} value={String(v ?? "")} onChange={(x) => setR(f.k, x)} />
      : <Select value={String(v ?? "")} onValueChange={(x) => setR(f.k, x)}><SelectTrigger><SelectValue placeholder={t("اختر")} /></SelectTrigger><SelectContent>{f.opts.map((o) => <SelectItem key={o} value={o}>{t(o)}</SelectItem>)}</SelectContent></Select>}</div>;
    if (f.link) return <div key={f.k} className="space-y-1.5 sm:col-span-2">{lab}{f.hint && <p className="text-xs text-muted-foreground">{t(f.hint)}</p>}
      <div className="flex items-center gap-2">
        <Input dir="ltr" placeholder="https://..." value={String(v ?? "")} onChange={(e) => setR(f.k, e.target.value.trim())}
          onPaste={f.k === "link_url" ? (e) => { const s = e.clipboardData.getData("text").trim(); if (s) setTimeout(() => pull(s), 0); } : undefined} />
        {!!String(v ?? "").trim() && <Button type="button" size="sm" variant="outline" onClick={() => window.open(href(String(v)), "_blank", "noopener")}><Link2 className="size-4" /> {t("فتح")}</Button>}
        {f.k === "link_url" && !!String(v ?? "").trim() && <Button type="button" size="sm" disabled={busy} onClick={() => pull(String(v))}><Download className="size-4" /> {t("سحب الملف")}</Button>}
      </div>
      {f.k === "link_url" && busy && <p className="text-xs text-muted-foreground">{t("جارٍ سحب الملف...")}</p>}
      </div>;
    return <div key={f.k} className={`space-y-1.5 ${f.long || f.hint ? "sm:col-span-2" : ""}`}>{lab}{f.hint && <p className="text-xs text-muted-foreground">{t(f.hint)}</p>}
      {f.long ? <Textarea value={String(v ?? "")} onChange={(e) => setR(f.k, e.target.value)} /> : <Input value={String(v ?? "")} onChange={(e) => setR(f.k, e.target.value)} />}</div>;
  };
  const [view, setView] = useState<D | null>(null);
  const [busy, setBusy] = useState(false);
  const fileName = (p: string) => p.split("/").pop()!.replace(/^\d+_/, "");
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const cur = (((edit?.request ?? {}) as Req)["docs"] as string[] | undefined) ?? [];
    const added: string[] = [];
    for (const f of Array.from(files)) {
      const path = `${u.user?.id}/${Date.now()}_${f.name.replace(/[^\w.\-\u0600-\u06FF]/g, "_")}`;
      const { error } = await supabase.storage.from("sales-files").upload(path, f);
      if (error) toast.error(`${t("تعذر رفع الملف")}: ${f.name}`); else added.push(path);
    }
    setR("docs", [...cur, ...added]); setBusy(false);
  }
  async function pull(url: string) {
    setBusy(true);
    try {
      const r = await pullLinkFile({ data: { url } });
      if (!r.ok) { toast.error(t(r.error)); return; }
      setEdit((e) => { const req = (e?.request ?? {}) as Req; const cur = (req["docs"] as string[] | undefined) ?? [];
        return { ...e, request: { ...req, has_docs: "نعم", docs: [...cur, r.path] } }; });
      toast.success(t("تم سحب الملف وإضافته للمشروع"));
    } catch { toast.error(t("تعذر سحب الملف")); } finally { setBusy(false); }
  }
  async function openFile(path: string) {
    const { data } = await supabase.storage.from("sales-files").createSignedUrl(path, 600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }
  async function removeFile(path: string) {
    await supabase.storage.from("sales-files").remove([path]);
    setR("docs", ((((edit?.request ?? {}) as Req)["docs"] as string[]) ?? []).filter((x) => x !== path));
  }
  const docsList = (paths: string[], del: boolean) => <ul className="space-y-1">{paths.map((p) => <li key={p} className="flex items-center gap-2 text-sm">
    <button type="button" className="text-primary underline" onClick={() => openFile(p)}>{fileName(p)}</button>
    {del && <Button type="button" size="icon" variant="ghost" className="size-6 text-destructive" aria-label={t("حذف")} onClick={() => removeFile(p)}><Trash2 className="size-3.5" /></Button>}</li>)}</ul>;
  const pick = (k: "stage" | "payout_status" | "client_type", label: string, opts: string[]) => (
    <div className="space-y-1.5"><Label>{label}</Label>
      <Select value={String(edit?.[k] ?? "")} onValueChange={(v) => set(k, v)}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>{opts.map((o) => <SelectItem key={o} value={o}>{t(o)}</SelectItem>)}</SelectContent>
      </Select></div>
  );

  return (
    <main className="space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">{t("المبيعات")}</h1>
        <div className="flex gap-2">
          {canEdit && <Button onClick={() => { setMode("pricing"); openDraft(blank()); }}><Plus />{t("طلب تسعيرة مشروع جديد")}</Button>}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{t("العمولة 2% من قيمة العقد النهائية قبل الضريبة، مقسومة حسب نسبة المشاركة.")}</p>

      <div className="flex gap-2">
        {(["month", "quarter", "year"] as const).map((p) => (
          <Button key={p} size="sm" variant={period === p ? "default" : "outline"} onClick={() => setPeriod(p)}>
            {t(p === "month" ? "هذا الشهر" : p === "quarter" ? "هذا الربع" : "هذه السنة")}</Button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        {[["إجمالي العقود", stats.contracts], ["المحصّل", stats.collected], ["العمولة المستحقة", stats.due], ["العمولة المصروفة", stats.paid]].map(([l, v]) => (
          <div key={l as string} className="rounded-lg border border-border bg-card p-4">
            <div className="text-sm text-muted-foreground">{t(l as string)}</div>
            <div className="mt-1 font-display text-2xl font-bold" dir="ltr">{fmt(v as number)}</div>
          </div>
        ))}
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold">{t("لوحة كل موظف مبيعات")}</h2>
        {perEmp.length === 0 ? <p className="text-sm text-muted-foreground">{t("لا توجد بيانات")}</p> :
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{perEmp.map(([name, e]) => (
          <div key={name} className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 font-display font-bold">{name}</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {[["الطلبات", e.n], ["فاز", e.won], ["إجمالي العقود", e.contracts], ["المحصّل", e.collected], ["العمولة المستحقة", e.due], ["العمولة المصروفة", e.paid]].map(([l, v]) => (
                <div key={l as string}><div className="text-muted-foreground">{t(l as string)}</div><div className="font-semibold" dir="ltr">{fmt(v as number)}</div></div>))}
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${e.contracts ? Math.min(100, (e.collected / e.contracts) * 100) : 0}%` }} /></div>
            <div className="mt-1 text-xs text-muted-foreground">{t("نسبة التحصيل")} {e.contracts ? Math.round((e.collected / e.contracts) * 100) : 0}%</div>
          </div>))}</div>}
      </section>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50"><tr>
            {["تاريخ التسجيل", "العميل", "المشروع", "مرحلة الاعتماد", "نوع العميل", "مشاركة", "المرحلة", "عرض السعر", "قيمة العقد", "المحصّل", "العمولة المستحقة", "حالة الصرف", ""].map((h) => <th key={h} className="p-2 text-start">{t(h)}</th>)}
          </tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={13} className="p-4 text-center text-muted-foreground">{t("لا توجد بيانات")}</td></tr>}
            {rows.map((d) => (
              <tr key={d.id} className="border-t border-border">
                <td className="p-2" dir="ltr">{new Date(d.created_at).toLocaleString(locale(), { dateStyle: "short", timeStyle: "short" })}</td>
                <td className="p-2">{d.client}</td><td className="p-2">{d.project}</td>
                <td className="p-2 whitespace-nowrap"><span className={`rounded-full px-2 py-0.5 text-xs ${myTurn(d) ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{t(wfLabel(d.workflow_step))}</span>{myTurn(d) && <button type="button" className="ms-1 text-xs text-primary underline" onClick={() => setView(d)}>{t("بانتظارك")}</button>}</td>
                <td className="p-2">{t(d.client_type)}</td>
                <td className="p-2">{d.shared ? `${d.partner_name} (${d.my_share}/${100 - Number(d.my_share)})` : "—"}</td>
                <td className="p-2">{t(d.stage)}</td>
                <td className="p-2" dir="ltr">{fmt(Number(d.quote_value))}</td><td className="p-2" dir="ltr">{fmt(Number(d.contract_value))}</td>
                <td className="p-2" dir="ltr">{fmt(Number(d.collected))}</td><td className="p-2 font-semibold" dir="ltr">{fmt(commissionDue(d))}</td>
                <td className="p-2">{t(d.payout_status)}</td>
                <td className="p-2 whitespace-nowrap"><Button size="icon" variant="ghost" className="size-7" aria-label={t("التفاصيل")} onClick={() => setView(d)}><Eye className="size-4" /></Button>{canEdit && <>
                  <Button size="icon" variant="ghost" className="size-7" aria-label={t("تعديل")} onClick={() => { setMode("pricing"); openDraft(d); }}><Pencil className="size-4" /></Button>
                  <Button size="icon" variant="ghost" className="size-7" aria-label={t("العمولة")} title={t("العمولة")} onClick={() => { setMode("commission"); setEdit(d); }}><Coins className="size-4" /></Button>
                  <Button size="icon" variant="ghost" className="size-7 text-destructive" aria-label={t("حذف")} onClick={() => remove(d)}><Trash2 className="size-4" /></Button></>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent dir={locale() === "en-GB" ? "ltr" : "rtl"} className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>{mode === "commission" ? `${t("العمولة")} — ${edit?.client ?? ""}` : edit?.id ? t("تعديل") : t("إضافة عميل")}</DialogTitle></DialogHeader>
          {edit && <div className="grid gap-4 sm:grid-cols-2">
            {mode === "pricing" && REQUEST_FORM.map((sec) => <div key={sec.title} className="contents">
              <h3 className="mt-2 border-b border-border pb-1 font-display font-bold sm:col-span-2">{t(sec.title)}</h3>
              {sec.title === "بيانات العميل" && <div className="space-y-1.5 sm:col-span-2"><Label>{t("اسم الشركة أو العميل")}<span className="text-destructive"> *</span></Label><Input value={edit.client ?? ""} onChange={(e) => set("client", e.target.value)} /></div>}
              {sec.title === "بيانات المشروع" && <div className="space-y-1.5 sm:col-span-2"><Label>{t("اسم المشروع")}<span className="text-destructive"> *</span></Label><Input value={edit.project ?? ""} onChange={(e) => set("project", e.target.value)} /></div>}
              {sec.fields.map(field)}
              {sec.title === "بيانات طلب التسعير والمستندات" && ((edit.request ?? {}) as Req)["has_docs"] === "نعم" && <div className="space-y-1.5 sm:col-span-2">
                <Label>{t("مستندات المشروع")}</Label>
                <Input type="file" multiple disabled={busy} onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
                {busy && <p className="text-xs text-muted-foreground">{t("جارٍ الرفع...")}</p>}
                {docsList((((edit.request ?? {}) as Req)["docs"] as string[]) ?? [], true)}
              </div>}
            </div>)}
            {mode === "commission" && <>
            <p className="text-xs text-muted-foreground sm:col-span-2">{t("تُحسب العمولة تلقائيًا وتُضاف لعمولات الموظف عند الموارد البشرية لتُصرف مع الراتب.")}</p>
            {pick("client_type", t("عميل جديد ولا سابق"), ["جديد", "سابق"])}
            {pick("stage", t("المرحلة"), STAGES)}
            <div className="space-y-1.5"><Label>{t("هل شارك موظف مبيعات آخر؟")}</Label>
              <Select value={edit.shared ? "نعم" : "لا"} onValueChange={(v) => setEdit((e) => ({ ...e, shared: v === "نعم", my_share: v === "نعم" ? 50 : 100 }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="نعم">{t("نعم")}</SelectItem><SelectItem value="لا">{t("لا")}</SelectItem></SelectContent>
              </Select></div>
            {edit.shared && <div className="space-y-1.5"><Label>{t("اسم الموظف الآخر")}</Label><Input value={edit.partner_name ?? ""} onChange={(e) => set("partner_name", e.target.value)} /></div>}
            {edit.shared && num("my_share", t("نسبتي %"))}
            {num("quote_value", t("قيمة عرض السعر المقدم"))}
            {num("contract_value", t("قيمة العقد النهائية (قبل الضريبة)"))}
            {num("collected", t("المبلغ المحصّل من العميل"))}
            {pick("payout_status", t("حالة صرف العمولة"), PAYOUT)}
            <div className="space-y-1.5"><Label>{t("العمولة المستحقة")}</Label><Input disabled dir="ltr" value={fmt(commissionDue(edit as D))} /></div>
            </>}
            <div className="space-y-1.5 sm:col-span-2"><Label>{t("ملاحظات")}</Label><Textarea value={edit.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></div>
          </div>}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEdit(null)}>{t("إلغاء")}</Button>
            <Button disabled={!edit || (mode === "pricing" && missing(edit))} onClick={save}>{t("حفظ")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent dir={locale() === "en-GB" ? "ltr" : "rtl"} className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>{t("طلب تسعيرة مشروع جديد")}</DialogTitle></DialogHeader>
          {view && <div className="space-y-4 text-sm">
            <div className="rounded-lg border border-border p-3 space-y-3">
              <h3 className="font-display font-bold">{t("مراحل الاعتماد")}</h3>
              <ol className="flex flex-wrap gap-1.5">{WF.map((s, i) => { const cur = WF.findIndex((x) => x.k === view.workflow_step); return <li key={s.k} className={`rounded-full px-2 py-0.5 text-xs ${i === cur ? "bg-primary text-primary-foreground" : i < cur ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}>{i + 1}. {t(s.l)}</li>; })}</ol>
              {view.pricing_value != null && <div><span className="text-muted-foreground">{t("التسعير")}:</span> <span dir="ltr">{fmt(Number(view.pricing_value))}</span></div>}
              {view.pricing_file_path && <div><span className="text-muted-foreground">{t("ملف التسعير")}:</span> <button type="button" className="text-primary underline" onClick={() => openFile(view.pricing_file_path!)}>{view.pricing_file_name}</button></div>}
              {view.quotation_file_path && <div><span className="text-muted-foreground">{t("عرض السعر (Quotation)")}:</span> <button type="button" className="text-primary underline" onClick={() => openFile(view.quotation_file_path!)}>{view.quotation_file_name}</button></div>}
              {myTurn(view) && <div className="space-y-2 border-t border-border pt-3">
                {view.workflow_step === "haitham_pricing" && <div className="space-y-1.5"><Label>{t("قيمة التسعير")} *</Label><Input dir="ltr" inputMode="decimal" value={wfPrice} onChange={(e) => setWfPrice(e.target.value.replace(/[^\d.]/g, ""))} /></div>}
                {(view.workflow_step === "haitham_pricing" || view.workflow_step === "eilaf_quotation") && <div className="space-y-1.5"><Label>{t(view.workflow_step === "haitham_pricing" ? "ملف التسعير" : "ملف عرض السعر (Quotation)")} *</Label><Input type="file" onChange={(e) => setWfFile(e.target.files?.[0] ?? null)} /></div>}
                <div className="space-y-1.5"><Label>{t("ملاحظات")}</Label><Textarea value={wfNote} onChange={(e) => setWfNote(e.target.value)} /></div>
                <div className="flex gap-2">
                  <Button disabled={wfBusy || (view.workflow_step === "haitham_pricing" && (!wfPrice || !wfFile)) || (view.workflow_step === "eilaf_quotation" && !wfFile)} onClick={() => advance(view, "approve")}>{t(view.workflow_step === "sales_entry" ? "إرسال للمراجعة" : "موافقة وإرسال")}</Button>
                  {view.workflow_step !== "sales_entry" && <Button variant="outline" className="text-destructive" disabled={wfBusy} onClick={() => advance(view, "reject")}>{t("رفض وإرجاع")}</Button>}
                </div>
              </div>}
              {((view.workflow_log ?? []) as LogE[]).length > 0 && <ul className="space-y-1 border-t border-border pt-2 text-xs">{((view.workflow_log ?? []) as LogE[]).map((l, i) => <li key={i}>
                <span dir="ltr">{new Date(l.at).toLocaleString(locale(), { dateStyle: "short", timeStyle: "short" })}</span> — {l.by}: {t(l.action === "reject" ? "رفض" : "موافقة")} ({t(wfLabel(l.from))} ← {t(wfLabel(l.to))}){l.note && <> — {l.note}</>}</li>)}</ul>}
            </div>
            <div><b>{t("اسم الشركة أو العميل")}:</b> {view.client}</div><div><b>{t("اسم المشروع")}:</b> {view.project}</div>
            {REQUEST_FORM.map((sec) => <div key={sec.title}><h3 className="mb-1 border-b border-border font-display font-bold">{t(sec.title)}</h3>
              {sec.title === "بيانات طلب التسعير والمستندات" && (((view.request ?? {}) as Req)["docs"] as string[] | undefined)?.length ? <div><span className="text-muted-foreground">{t("مستندات المشروع")}:</span>{docsList(((view.request as Req)["docs"] as string[]), false)}</div> : null}
              {sec.fields.map((f) => { const v = ((view.request ?? {}) as Req)[f.k]; return <div key={f.k}><span className="text-muted-foreground">{t(f.l)}:</span> {Array.isArray(v) ? v.map((x) => t(x)).join("، ") : v ? (f.link ? <a className="text-primary underline" dir="ltr" href={href(String(v))} target="_blank" rel="noopener noreferrer">{String(v)}</a> : f.opts ? t(v) : v) : "—"}</div>; })}</div>)}
          </div>}
        </DialogContent>
      </Dialog>
    </main>
  );
}
