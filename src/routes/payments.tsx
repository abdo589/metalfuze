import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownCircle, ArrowUpCircle, FileDown, FileText, Pencil, Plus, Scale, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCanEdit } from "@/lib/permissions";
import { t, useLanguage, locale } from "@/lib/i18n";
import { fmtMoney, newId, useProjects } from "@/lib/projects";
import { totals, txnStore, useTransactions, type Txn, type TxnType } from "@/lib/transactions";
import logoAsset from "@/assets/metal-fuze-logo.png.asset.json";

export const Route = createFileRoute("/payments")({
  head: () => ({
    meta: [
      { title: "الدفع والتحصيل — METAL FUZE PROJECTS" },
      { name: "description", content: "تحصيل من العملاء ودفع للموردين لكل مدير مشروع مع فاتورة لكل حركة وكشف حساب." },
      { property: "og:title", content: "الدفع والتحصيل — METAL FUZE PROJECTS" },
      { property: "og:description", content: "فواتير الدفع والتحصيل وكشوف حساب مسؤولي المشاريع." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Payments,
});

const sar = (n: number) => `${fmtMoney(n)} ${t("ر.س")}`;
const fmtDate = (d: string) => new Date(d).toLocaleDateString(locale(), { dateStyle: "medium" });
const typeLabel = (x: TxnType) => (x === "collect" ? t("تحصيل") : t("دفع"));

type Doc = { kind: "invoice"; txn: Txn } | { kind: "statement"; manager: string };

function Payments() {
  useLanguage();
  const canEdit = useCanEdit();
  const txns = useTransactions();
  const projects = useProjects();
  const managers = useMemo(() => {
    const set = new Set(projects.map((p) => p.manager.trim()).filter(Boolean));
    txns.forEach((x) => x.manager && set.add(x.manager));
    return [...set].sort();
  }, [projects, txns]);
  const [manager, setManager] = useState("all");
  const [editing, setEditing] = useState<Txn | null>(null);
  const [open, setOpen] = useState(false);
  const [doc, setDoc] = useState<Doc | null>(null);
  const paperRef = useRef<HTMLDivElement>(null);

  const shown = txns.filter((x) => manager === "all" || x.manager === manager)
    .sort((a, b) => b.date.localeCompare(a.date));
  const sum = totals(shown);
  const scoped = projects.filter((p) => manager === "all" || p.manager.trim() === manager);
  const contractSum = scoped.reduce((a, p) => a + p.contract, 0);
  const collectedSum = scoped.reduce((a, p) => a + p.paid, 0);

  useEffect(() => {
    if (!doc || !paperRef.current) return;
    const name = doc.kind === "invoice" ? `Metal-Fuze-${doc.txn.number}.pdf` : `Metal-Fuze-Statement-${doc.manager}.pdf`;
    import("@/lib/pdf").then(({ exportElementPdf }) => exportElementPdf(paperRef.current!, name))
      .then(() => toast.success(t("تم حفظ PDF")))
      .catch(() => toast.error(t("تعذر حفظ PDF، حاول مرة أخرى")))
      .finally(() => setDoc(null));
  }, [doc]);

  async function statementExcel(m: string) {
    const list = txns.filter((x) => x.manager === m).sort((a, b) => a.date.localeCompare(b.date));
    const s = totals(list);
    let run = 0;
    const { exportBrandedExcel } = await import("@/lib/branded-excel");
    await exportBrandedExcel({
      filename: `Metal-Fuze-Statement-${m}.xlsx`,
      reportTitle: `${t("كشف حساب")} — ${m}`,
      summary: [[t("إجمالي التحصيل"), s.collected, "money"], [t("إجمالي الدفع"), s.paid, "money"], [t("الرصيد"), s.balance, "money"]],
      sheets: [{
        name: t("كشف حساب"), title: `${t("كشف حساب")} — ${m}`,
        columns: [
          { header: t("رقم الفاتورة"), width: 13 }, { header: t("التاريخ"), width: 13 }, { header: t("النوع") },
          { header: t("المشروع"), width: 26 }, { header: t("العميل / المورد"), width: 24 },
          { header: t("تحصيل"), format: "money", width: 16 }, { header: t("دفع"), format: "money", width: 16 },
          { header: t("الرصيد"), format: "money", width: 16 }, { header: t("ملاحظات"), width: 26 },
        ],
        rows: list.map((x) => {
          run += x.type === "collect" ? x.amount : -x.amount;
          return [x.number, x.date, typeLabel(x.type), x.project, x.party,
            x.type === "collect" ? x.amount : 0, x.type === "pay" ? x.amount : 0, run, x.notes];
        }),
        totals: [5, 6],
      }],
    });
    toast.success(t("تم التصدير"));
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col items-center gap-4 text-center">
        <div>
          <h1 className="font-display text-3xl font-extrabold sm:text-4xl">{t("الدفع والتحصيل")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("تحصيل من العملاء ودفع للموردين لكل مسؤول مشروع")}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2 print:hidden">
          <select value={manager} onChange={(e) => setManager(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm">
            <option value="all">{t("كل المسؤولين")}</option>
            {managers.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          {canEdit && <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus /> {t("حركة جديدة")}</Button>}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: t("قيمة العقود"), value: sar(contractSum), icon: Scale },
          { label: t("تم تحصيله"), value: sar(collectedSum), icon: ArrowDownCircle },
          { label: t("المتبقي للتحصيل"), value: sar(contractSum - collectedSum), icon: Scale },
          { label: t("تم دفعه للموردين"), value: sar(sum.paid), icon: ArrowUpCircle },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground"><k.icon className="size-4" /><span className="text-xs">{k.label}</span></div>
            <div className="mt-2 font-display text-xl font-bold">{k.value}</div>
          </div>
        ))}
      </div>

      {/* حسب المسؤول */}
      <section className="rounded-xl border border-border bg-card">
        <h2 className="border-b border-border p-4 font-display text-lg font-bold">{t("حسب مسؤول المشروع")}</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead><tr className="border-b border-border text-start text-xs text-muted-foreground">
              <th className="p-3 text-start font-medium">{t("مدير المشروع")}</th>
              <th className="p-3 text-start font-medium">{t("عدد المشاريع")}</th>
              <th className="p-3 text-start font-medium">{t("قيمة العقود")}</th>
              <th className="p-3 text-start font-medium">{t("تم تحصيله")}</th>
              <th className="p-3 text-start font-medium">{t("المتبقي للتحصيل")}</th>
              <th className="p-3 text-start font-medium">{t("تم دفعه للموردين")}</th>
              <th className="p-3 text-start font-medium">{t("كشف حساب")}</th>
            </tr></thead>
            <tbody>
              {managers.filter((m) => manager === "all" || m === manager).map((m) => {
                const list = txns.filter((x) => x.manager === m);
                const s = totals(list);
                const mp = projects.filter((p) => p.manager.trim() === m);
                const contract = mp.reduce((a, p) => a + p.contract, 0);
                const got = mp.reduce((a, p) => a + p.paid, 0);
                return (
                  <tr key={m} className="border-b border-border/60">
                    <td className="p-3 font-medium">{m}</td>
                    <td className="p-3">{mp.length}</td>
                    <td className="p-3">{sar(contract)}</td>
                    <td className="p-3 text-primary">{sar(got)}</td>
                    <td className="p-3 font-bold">{sar(contract - got)}</td>
                    <td className="p-3 text-destructive">{sar(s.paid)}</td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" disabled={!list.length || !!doc} onClick={() => setDoc({ kind: "statement", manager: m })}><FileText /> PDF</Button>
                        <Button size="sm" variant="outline" disabled={!list.length} onClick={() => statementExcel(m)}><FileDown /> Excel</Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* حسب المشروع */}
      <section className="rounded-xl border border-border bg-card">
        <h2 className="border-b border-border p-4 font-display text-lg font-bold">{t("حسب المشروع")}</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead><tr className="border-b border-border text-xs text-muted-foreground">
              {["المشروع", "مدير المشروع", "قيمة العقد", "تم تحصيله", "تم دفعه للموردين", "المتبقي للتحصيل", "صافي المشروع"].map((h) =>
                <th key={h} className="p-3 text-start font-medium">{t(h)}</th>)}
            </tr></thead>
            <tbody>
              {projects.filter((p) => manager === "all" || p.manager.trim() === manager).map((p) => {
                const s = totals(txns.filter((x) => x.project.trim() === p.name.trim()));
                return (
                  <tr key={p.id} className="border-b border-border/60">
                    <td className="p-3 font-medium">{p.name}</td>
                    <td className="p-3">{p.manager}</td>
                    <td className="p-3">{sar(p.contract)}</td>
                    <td className="p-3 text-primary">{sar(p.paid)}</td>
                    <td className="p-3 text-destructive">{sar(s.paid)}</td>
                    <td className="p-3 font-bold">{sar(p.contract - p.paid)}</td>
                    <td className="p-3">{sar(p.paid - s.paid)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* الحركات */}
      <section className="rounded-xl border border-border bg-card">
        <h2 className="border-b border-border p-4 font-display text-lg font-bold">{t("الفواتير")}</h2>
        {shown.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">{t("لا توجد حركات بعد")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead><tr className="border-b border-border text-xs text-muted-foreground">
                {["رقم الفاتورة", "التاريخ", "النوع", "مدير المشروع", "المشروع", "العميل / المورد", "المبلغ", "إجراءات"].map((h) =>
                  <th key={h} className="p-3 text-start font-medium">{t(h)}</th>)}
              </tr></thead>
              <tbody>
                {shown.map((x) => (
                  <tr key={x.id} className="border-b border-border/60">
                    <td className="p-3 font-mono" dir="ltr">{x.number}</td>
                    <td className="p-3">{fmtDate(x.date)}</td>
                    <td className="p-3"><Badge variant={x.type === "collect" ? "default" : "destructive"}>{x.type === "collect" ? t("استلم") : t("دفع")}</Badge></td>
                    <td className="p-3">{x.manager}</td>
                    <td className="p-3">{x.project}</td>
                    <td className="p-3">{x.party}</td>
                    <td className="p-3 font-bold">{sar(x.amount)}</td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" disabled={!!doc} onClick={() => setDoc({ kind: "invoice", txn: x })}><FileText /> {t("الفاتورة")}</Button>
                        {canEdit && <>
                          <Button size="icon" variant="ghost" aria-label={t("تعديل")} onClick={() => { setEditing(x); setOpen(true); }}><Pencil /></Button>
                          <Button size="icon" variant="ghost" aria-label={t("حذف")} onClick={() => { if (confirm(t("حذف هذه الحركة؟"))) txnStore.remove(x.id); }}><Trash2 /></Button>
                        </>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <TxnDialog open={open} onOpenChange={setOpen} txn={editing} managers={managers}
        projects={projects.map((p) => ({ name: p.name, manager: p.manager }))} />

      {doc && (
        <div style={{ position: "fixed", left: -10000, top: 0 }} aria-hidden>
          <div ref={paperRef} className="invoice-paper" style={{ width: 794 }}
            dir={locale() === "en-GB" ? "ltr" : "rtl"}>
            {doc.kind === "invoice" ? <InvoicePaper x={doc.txn} /> :
              <StatementPaper m={doc.manager} list={txns.filter((x) => x.manager === doc.manager).sort((a, b) => a.date.localeCompare(b.date))} />}
          </div>
        </div>
      )}
    </div>
  );
}

function PaperHeader({ title, number }: { title: string; number?: string }) {
  return (
    <div className="inv-border flex items-center justify-between border-b-2 pb-4">
      <img src={logoAsset.url} alt="Metal Fuze" style={{ width: 190 }} crossOrigin="anonymous" />
      <div className="text-end">
        <div className="inv-accent text-2xl font-extrabold">{title}</div>
        {number && <div className="font-mono text-lg" dir="ltr">{number}</div>}
        <div className="inv-muted text-xs">{t("تاريخ الإصدار:")}{new Date().toLocaleDateString(locale(), { dateStyle: "long" })}</div>
      </div>
    </div>
  );
}

function InvoicePaper({ x }: { x: Txn }) {
  const rows: [string, string][] = [
    [t("التاريخ"), fmtDate(x.date)],
    [t("مدير المشروع"), x.manager],
    [t("المشروع"), x.project || "—"],
    [x.type === "collect" ? t("استلمنا من (العميل)") : t("دفعنا إلى (المورد)"), x.party || "—"],
    [t("طريقة الدفع"), x.method || "—"],
  ];
  return (
    <div className="space-y-6 p-10" style={{ minHeight: 1000 }}>
      <PaperHeader title={x.type === "collect" ? t("سند تحصيل") : t("سند دفع")} number={x.number} />
      <table className="w-full text-sm"><tbody>
        {rows.map(([k, v]) => (
          <tr key={k} className="inv-border inv-zebra border-b"><td className="inv-muted w-48 p-3">{k}</td><td className="p-3 font-medium">{v}</td></tr>
        ))}
      </tbody></table>
      <div className="inv-head flex items-center justify-between rounded-lg p-5">
        <span className="text-lg font-bold">{t("المبلغ")}</span>
        <span className="text-3xl font-extrabold">{sar(x.amount)}</span>
      </div>
      {x.notes && <div><div className="inv-muted mb-1 text-xs">{t("ملاحظات")}</div><p className="text-sm">{x.notes}</p></div>}
      <div className="grid grid-cols-2 gap-10 pt-16 text-center text-sm">
        <div className="inv-border border-t pt-2">{x.type === "collect" ? t("توقيع المستلم") : t("توقيع المحاسب")}</div>
        <div className="inv-border border-t pt-2">{x.manager} — {t("مدير المشروع")}</div>
      </div>
      <div className="inv-muted pt-10 text-center text-xs">Metal Fuze — Accuracy Has No Limit</div>
    </div>
  );
}

function StatementPaper({ m, list }: { m: string; list: Txn[] }) {
  const s = totals(list);
  let run = 0;
  return (
    <div className="space-y-6 p-10">
      <PaperHeader title={t("كشف حساب")} />
      <div className="inv-accent text-lg font-bold">{t("مدير المشروع")}: {m}</div>
      <div className="grid grid-cols-3 gap-3 text-center">
        {[[t("إجمالي التحصيل"), s.collected], [t("إجمالي الدفع"), s.paid], [t("الرصيد"), s.balance]].map(([k, v]) => (
          <div key={k as string} className="inv-border rounded-lg border p-3"><div className="inv-muted text-xs">{k}</div><div className="text-lg font-bold">{sar(v as number)}</div></div>
        ))}
      </div>
      <table className="w-full text-xs">
        <thead><tr className="inv-head">
          {["رقم الفاتورة", "التاريخ", "المشروع", "العميل / المورد", "تحصيل", "دفع", "الرصيد"].map((h) => <th key={h} className="p-2 text-start">{t(h)}</th>)}
        </tr></thead>
        <tbody>
          {list.map((x) => {
            run += x.type === "collect" ? x.amount : -x.amount;
            return (
              <tr key={x.id} className="inv-border inv-zebra border-b">
                <td className="p-2 font-mono" dir="ltr">{x.number}</td><td className="p-2">{fmtDate(x.date)}</td>
                <td className="p-2">{x.project}</td><td className="p-2">{x.party}</td>
                <td className="p-2">{x.type === "collect" ? sar(x.amount) : ""}</td>
                <td className="p-2">{x.type === "pay" ? sar(x.amount) : ""}</td>
                <td className="p-2 font-bold">{sar(run)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TxnDialog({ open, onOpenChange, txn, managers, projects }: {
  open: boolean; onOpenChange: (o: boolean) => void; txn: Txn | null; managers: string[];
  projects: { name: string; manager: string }[];
}) {
  const blank = (): Txn => ({ id: newId(), number: "", type: "collect", date: new Date().toISOString().slice(0, 10),
    manager: managers[0] ?? "", project: "", party: "", amount: 0, method: t("تحويل بنكي"), notes: "" });
  const [f, setF] = useState<Txn>(blank());
  useEffect(() => { if (open) setF(txn ?? blank()); }, [open, txn]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = <K extends keyof Txn>(k: K, v: Txn[K]) => setF((p) => ({ ...p, [k]: v }));
  const mine = projects.filter((p) => p.manager === f.manager);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir={locale() === "en-GB" ? "ltr" : "rtl"} className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display text-xl">{txn ? t("تعديل حركة") : t("حركة جديدة")}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          {(["collect", "pay"] as TxnType[]).map((ty) => (
            <Button key={ty} type="button" variant={f.type === ty ? "default" : "outline"} onClick={() => set("type", ty)}>
              {ty === "collect" ? <><ArrowDownCircle /> {t("تحصيل من العميل")}</> : <><ArrowUpCircle /> {t("دفع للمورد")}</>}
            </Button>
          ))}
        </div>
        <datalist id="txn-managers">{managers.map((m) => <option key={m} value={m} />)}</datalist>
        <datalist id="txn-projects">{(mine.length ? mine : projects).map((p) => <option key={p.name} value={p.name} />)}</datalist>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>{t("مدير المشروع")}</Label><Input list="txn-managers" value={f.manager} onChange={(e) => set("manager", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>{t("المشروع")}</Label><Input list="txn-projects" value={f.project} onChange={(e) => set("project", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>{f.type === "collect" ? t("العميل") : t("المورد")}</Label><Input value={f.party} onChange={(e) => set("party", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>{t("التاريخ")}</Label><Input type="date" dir="ltr" value={f.date} onChange={(e) => set("date", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>{t("المبلغ")}</Label><Input type="number" dir="ltr" value={f.amount} onChange={(e) => set("amount", Number(e.target.value))} /></div>
          <div className="space-y-1.5"><Label>{t("طريقة الدفع")}</Label><Input value={f.method} onChange={(e) => set("method", e.target.value)} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>{t("ملاحظات")}</Label><Textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} /></div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("إلغاء")}</Button>
          <Button disabled={!f.manager.trim() || f.amount <= 0} onClick={() => { txnStore.upsert(f); onOpenChange(false); toast.success(t("تم الحفظ")); }}>{t("حفظ")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
