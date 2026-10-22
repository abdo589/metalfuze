import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
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

export const Route = createFileRoute("/sales")({
  head: () => ({ meta: [
    { title: "المبيعات والعمولات — Metal Fuze" },
    { name: "description", content: "سجل العملاء وعروض الأسعار والعقود وعمولة المبيعات 2%." },
    { property: "og:title", content: "المبيعات والعمولات — Metal Fuze" },
    { property: "og:description", content: "سجل العملاء وعروض الأسعار والعقود وعمولة المبيعات." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: SalesPage,
});

const FORM_URL = "https://form.asana.com/?k=siS1k0Llj6fcssPfgOni4w&d=1216553096721183";
const STAGES = ["تسعير", "تم تقديم العرض", "فاز", "خسر"];
const PAYOUT = ["لم تُستحق", "مستحقة", "مصروفة"];
type D = Tables<"sales_deals">;
const blank = (): Partial<D> => ({ client: "", project: "", client_type: "جديد", shared: false, partner_name: "", my_share: 100, quote_value: 0, contract_value: 0, collected: 0, commission_rate: 2, payout_status: "لم تُستحق", stage: "تسعير", notes: "" });
const fmt = (n: number) => Math.round(n).toLocaleString(locale());

function SalesPage() {
  useLanguage();
  const role = useRole();
  const canEdit = role === "sales";
  const [rows, setRows] = useState<D[]>([]);
  const [edit, setEdit] = useState<Partial<D> | null>(null);
  const now = new Date();
  const [period, setPeriod] = useState<"month" | "quarter" | "year">("month");

  const load = useCallback(async () => {
    const { data } = await supabase.from("sales_deals").select("*").order("created_at", { ascending: false });
    setRows(data ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

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

  async function save(): Promise<void> {
    if (!edit) return;
    const { id, created_at: _c, owner_id: _o, ...rest } = edit as D;
    const payload = { ...rest, updated_at: new Date().toISOString() };
    const { error } = id ? await supabase.from("sales_deals").update(payload).eq("id", id) : await supabase.from("sales_deals").insert(payload);
    if (error) return toast.error(t("تعذر الحفظ، حاول مرة أخرى"));
    toast.success(t("تم الحفظ")); setEdit(null); load();
  }
  async function remove(d: D) {
    if (!confirm(t("حذف؟"))) return;
    await supabase.from("sales_deals").delete().eq("id", d.id); load();
  }
  const set = <K extends keyof D>(k: K, v: D[K]) => setEdit((e) => ({ ...e, [k]: v }));
  const num = (k: "quote_value" | "contract_value" | "collected" | "my_share" | "commission_rate", label: string) => (
    <div className="space-y-1.5"><Label>{label}</Label>
      <Input type="text" inputMode="decimal" dir="ltr" placeholder="0" value={String(edit?.[k] ?? "")}
        onChange={(e) => set(k, Number(e.target.value.replace(/[^\d.]/g, "")) as never)} /></div>
  );
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
        <h1 className="font-display text-2xl font-bold">{t("المبيعات والعمولات")}</h1>
        <div className="flex gap-2">
          <Button variant="outline" asChild><a href={FORM_URL} target="_blank" rel="noreferrer"><ExternalLink />{t("نموذج طلب تسعيرة (Asana)")}</a></Button>
          {canEdit && <Button onClick={() => setEdit(blank())}><Plus />{t("إضافة عميل")}</Button>}
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

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50"><tr>
            {["تاريخ التسجيل", "العميل", "المشروع", "نوع العميل", "مشاركة", "المرحلة", "عرض السعر", "قيمة العقد", "المحصّل", "العمولة المستحقة", "حالة الصرف", ""].map((h) => <th key={h} className="p-2 text-start">{t(h)}</th>)}
          </tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={12} className="p-4 text-center text-muted-foreground">{t("لا توجد بيانات")}</td></tr>}
            {rows.map((d) => (
              <tr key={d.id} className="border-t border-border">
                <td className="p-2" dir="ltr">{new Date(d.created_at).toLocaleString(locale(), { dateStyle: "short", timeStyle: "short" })}</td>
                <td className="p-2">{d.client}</td><td className="p-2">{d.project}</td><td className="p-2">{t(d.client_type)}</td>
                <td className="p-2">{d.shared ? `${d.partner_name} (${d.my_share}/${100 - Number(d.my_share)})` : "—"}</td>
                <td className="p-2">{t(d.stage)}</td>
                <td className="p-2" dir="ltr">{fmt(Number(d.quote_value))}</td><td className="p-2" dir="ltr">{fmt(Number(d.contract_value))}</td>
                <td className="p-2" dir="ltr">{fmt(Number(d.collected))}</td><td className="p-2 font-semibold" dir="ltr">{fmt(commissionDue(d))}</td>
                <td className="p-2">{t(d.payout_status)}</td>
                <td className="p-2 whitespace-nowrap">{canEdit && <>
                  <Button size="icon" variant="ghost" className="size-7" aria-label={t("تعديل")} onClick={() => setEdit(d)}><Pencil className="size-4" /></Button>
                  <Button size="icon" variant="ghost" className="size-7 text-destructive" aria-label={t("حذف")} onClick={() => remove(d)}><Trash2 className="size-4" /></Button></>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent dir={locale() === "en-GB" ? "ltr" : "rtl"} className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>{edit?.id ? t("تعديل") : t("إضافة عميل")}</DialogTitle></DialogHeader>
          {edit && <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>{t("العميل")}</Label><Input value={edit.client ?? ""} onChange={(e) => set("client", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>{t("المشروع")}</Label><Input value={edit.project ?? ""} onChange={(e) => set("project", e.target.value)} /></div>
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
            <div className="space-y-1.5 sm:col-span-2"><Label>{t("ملاحظات")}</Label><Textarea value={edit.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></div>
          </div>}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEdit(null)}>{t("إلغاء")}</Button>
            <Button disabled={!edit?.client?.trim()} onClick={save}>{t("حفظ")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
