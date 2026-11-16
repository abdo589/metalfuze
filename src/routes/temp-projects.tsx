import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Archive, Download, Eye, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { t, useLanguage, locale } from "@/lib/i18n";
import { useAuthSession } from "@/lib/auth-session";
import { isSalesReviewer } from "@/lib/sales";
import { pricingAttachments, quotationAttachments, type SalesAttachment } from "@/lib/sales-file";
import { openSalesFile } from "@/lib/sales-file-open";
import { REJECTED_STEP, REQUEST_FORM, docFileName, href, logActionLabel, wfLabel, type LogE, type Req } from "@/lib/sales-form";
import { useLiveRefresh } from "@/lib/live-refresh";
import { readCache } from "@/lib/read-cache";

export const Route = createFileRoute("/temp-projects")({
  head: () => ({ meta: [
    { title: "مشاريع مؤقتة — Metal Fuze" },
    { name: "description", content: "طلبات التسعير المرفوضة بكل بياناتها وملفاتها، مع الإرجاع للمبيعات أو الحذف." },
    { property: "og:title", content: "مشاريع مؤقتة — Metal Fuze" },
    { property: "og:description", content: "طلبات التسعير المرفوضة بكل ملفاتها في مكان واحد." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: TempProjectsPage,
});

type D = Tables<"sales_deals">;
const fmt = (n: number) => Math.round(n).toLocaleString(locale());
const lastReject = (d: D) => [...((d.workflow_log ?? []) as LogE[])].reverse().find((l) => l.action === "reject");

function TempProjectsPage() {
  useLanguage();
  const session = useAuthSession();
  const user = session?.user;
  const isEilaf = isSalesReviewer(user ? { id: user.id, email: user.email ?? "", emailConfirmed: !!user.email_confirmed_at } : null);
  const [rows, setRows] = useState<D[] | null>(null);
  const [view, setView] = useState<D | null>(null);
  const [restore, setRestore] = useState<D | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    readCache.clearTable("sales_deals");
    const { data, error } = await supabase.from("sales_deals").select("*").eq("workflow_step", REJECTED_STEP).order("updated_at", { ascending: false });
    if (error) { toast.error(t("تعذر التحميل")); return; }
    setRows(data ?? []);
  }, []);
  useEffect(() => { if (isEilaf) void load(); }, [isEilaf, load]);
  useLiveRefresh(["sales_deals"], () => isEilaf ? load() : undefined);
  useEffect(() => { setView((v) => v && rows ? rows.find((r) => r.id === v.id) ?? null : v); }, [rows]);

  async function openFile(path: string, name: string, download = false) {
    try {
      await openSalesFile(name, async (asDownload) => {
        const { data, error } = await supabase.storage.from("sales-files").createSignedUrl(path, 300, asDownload ? { download: name } : undefined);
        if (error || !data?.signedUrl) throw error ?? new Error("File URL unavailable");
        return data.signedUrl;
      }, download);
    } catch { toast.error(t("تعذر فتح الملف، حاول مرة أخرى")); }
  }
  async function doRestore() {
    if (!restore || busy) return;
    setBusy(true);
    const { error } = await supabase.rpc("sales_restore_rejected", { p_id: restore.id, p_note: note });
    setBusy(false);
    if (error) { toast.error(t("تعذر الحفظ، حاول مرة أخرى")); return; }
    toast.success(t("تم إرجاع الطلب لصفحة المبيعات")); setRestore(null); setNote(""); setView(null); void load();
  }
  async function remove(d: D) {
    if (!confirm(t("حذف هذا المشروع نهائيًا؟ لا يمكن التراجع."))) return;
    const { error } = await supabase.from("sales_deals").delete().eq("id", d.id);
    if (error) { toast.error(t("تعذر الحذف")); return; }
    toast.success(t("تم الحذف")); setView(null); void load();
  }

  if (session === undefined) return <main className="p-4 md:p-8"><p className="text-sm text-muted-foreground">{t("جارٍ التحميل…")}</p></main>;
  if (!isEilaf) return <main className="p-4 md:p-8"><p className="text-sm text-muted-foreground">{t("هذه الصفحة متاحة لإيلاف فقط.")}</p></main>;

  const fileList = (files: SalesAttachment[]) => files.length ? <ul className="space-y-1">{files.map((f) => <li key={f.path} className="flex items-center gap-2">
    <Button type="button" variant="link" className="h-auto min-w-0 whitespace-normal break-all p-0 text-start" onClick={() => openFile(f.path, f.name)}>{f.name}</Button>
    <Button type="button" size="icon" variant="ghost" className="size-6 shrink-0" aria-label={`${t("تحميل")} ${f.name}`} title={t("تحميل")} onClick={() => openFile(f.path, f.name, true)}><Download className="size-3.5" /></Button>
  </li>)}</ul> : <p className="text-xs text-muted-foreground">—</p>;
  const docs = (d: D) => ((((d.request ?? {}) as Req)["docs"] as string[] | undefined) ?? []).map((p) => ({ path: p, name: docFileName(p) }));
  const fileCount = (d: D) => docs(d).length + pricingAttachments(d).length + quotationAttachments(d).length;

  return (
    <main className="space-y-6 p-4 md:p-8">
      <div className="space-y-1">
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold"><Archive className="size-6" />{t("مشاريع مؤقتة")}</h1>
        <p className="text-sm text-muted-foreground">{t("أي طلب تسعير يُرفض في المبيعات ينتقل هنا بكل بياناته وملفاته.")}</p>
      </div>
      {rows === null ? <p className="text-sm text-muted-foreground">{t("جارٍ التحميل…")}</p>
        : rows.length === 0 ? <p className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">{t("لا توجد مشاريع مرفوضة")}</p>
        : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{rows.map((d) => { const r = lastReject(d); return (
          <article key={d.id} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
            <div className="min-w-0">
              <h2 className="break-words font-display font-bold">{d.project || "—"}</h2>
              <p className="break-words text-sm text-muted-foreground">{d.client}</p>
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              <dt className="text-muted-foreground">{t("موظف المبيعات")}</dt><dd>{String(((d.request ?? {}) as Req)["sales_name"] ?? "—")}</dd>
              <dt className="text-muted-foreground">{t("رُفض من")}</dt><dd>{r?.by || "—"}</dd>
              <dt className="text-muted-foreground">{t("في مرحلة")}</dt><dd>{r ? t(wfLabel(r.from)) : "—"}</dd>
              <dt className="text-muted-foreground">{t("تاريخ الرفض")}</dt><dd dir="ltr" className="text-start">{r ? new Date(r.at).toLocaleString(locale(), { dateStyle: "short", timeStyle: "short" }) : "—"}</dd>
              <dt className="text-muted-foreground">{t("الملفات")}</dt><dd>{fileCount(d)}</dd>
            </dl>
            {r?.note && <p className="rounded-md bg-muted p-2 text-sm"><span className="text-muted-foreground">{t("سبب الرفض")}:</span> {r.note}</p>}
            <div className="mt-auto flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setView(d)}><Eye className="size-4" />{t("التفاصيل والملفات")}</Button>
              <Button size="sm" onClick={() => { setNote(""); setRestore(d); }}><RotateCcw className="size-4" />{t("إرجاع للمبيعات")}</Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(d)}><Trash2 className="size-4" />{t("حذف نهائي")}</Button>
            </div>
          </article>); })}</div>}

      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent dir={locale() === "en-GB" ? "ltr" : "rtl"} className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>{view?.project}</DialogTitle></DialogHeader>
          {view && <div className="space-y-4 text-sm">
            <div className="space-y-3 rounded-lg border border-border p-3">
              {view.pricing_value != null && <div><span className="text-muted-foreground">{t("التسعير")}:</span> <span dir="ltr">{fmt(Number(view.pricing_value))}</span></div>}
              <div><div className="text-muted-foreground">{t("ملف التسعير")}:</div>{fileList(pricingAttachments(view))}</div>
              <div><div className="text-muted-foreground">{t("عرض السعر (Quotation)")}:</div>{fileList(quotationAttachments(view))}</div>
              <div><div className="text-muted-foreground">{t("مستندات المشروع")}:</div>{fileList(docs(view))}</div>
              {((view.workflow_log ?? []) as LogE[]).length > 0 && <ul className="space-y-1 border-t border-border pt-2 text-xs">{((view.workflow_log ?? []) as LogE[]).map((l, i) => <li key={i}>
                <span dir="ltr">{new Date(l.at).toLocaleString(locale(), { dateStyle: "short", timeStyle: "short" })}</span> — {l.by}: {t(logActionLabel(l.action))} ({t(wfLabel(l.from))} ← {t(wfLabel(l.to))}){l.note && <> — {l.note}</>}</li>)}</ul>}
            </div>
            <div><b>{t("اسم الشركة أو العميل")}:</b> {view.client}</div><div><b>{t("اسم المشروع")}:</b> {view.project}</div>
            {REQUEST_FORM.map((sec) => <div key={sec.title}><h3 className="mb-1 border-b border-border font-display font-bold">{t(sec.title)}</h3>
              {sec.fields.map((f) => { const v = ((view.request ?? {}) as Req)[f.k]; return <div key={f.k}><span className="text-muted-foreground">{t(f.l)}:</span> {Array.isArray(v) ? v.map((x) => t(x)).join("، ") : v ? (f.link ? <a className="text-primary underline" dir="ltr" href={href(String(v))} target="_blank" rel="noopener noreferrer">{String(v)}</a> : f.opts ? t(v) : v) : "—"}</div>; })}</div>)}
            {view.notes && <div><b>{t("ملاحظات")}:</b> {view.notes}</div>}
          </div>}
          {view && <DialogFooter className="gap-2">
            <Button variant="ghost" className="text-destructive" onClick={() => remove(view)}><Trash2 className="size-4" />{t("حذف نهائي")}</Button>
            <Button onClick={() => { setNote(""); setRestore(view); }}><RotateCcw className="size-4" />{t("إرجاع للمبيعات")}</Button>
          </DialogFooter>}
        </DialogContent>
      </Dialog>

      <Dialog open={!!restore} onOpenChange={(o) => { if (!o && !busy) setRestore(null); }}>
        <DialogContent dir={locale() === "en-GB" ? "ltr" : "rtl"} className="max-w-md">
          <DialogHeader><DialogTitle>{t("إرجاع للمبيعات")}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{t("يرجع الطلب لصفحة المبيعات في مرحلة «مراجعة وموافقة Eilaf» بكل ملفاته.")}</p>
          <div className="space-y-1.5"><Label htmlFor="restore-note">{t("ملاحظات")} ({t("اختياري")})</Label><Textarea id="restore-note" value={note} onChange={(e) => setNote(e.target.value)} /></div>
          <DialogFooter className="gap-2">
            <Button variant="outline" disabled={busy} onClick={() => setRestore(null)}>{t("إلغاء")}</Button>
            <Button disabled={busy} onClick={doRestore}>{t("إرجاع للمبيعات")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
