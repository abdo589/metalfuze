import { useCallback, useEffect, useState } from "react";
import { Coins, Eye, Pencil, Plus, Save, Trash2, TrendingUp, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { commissionDue } from "@/lib/sales";

type Kind = "advances" | "commissions";
type Row = { id: string; data: Record<string, string | number> };
type Field = { k: string; type?: "number" | "date" | "select" | "month"; opts?: string[] };

const ID = "رقم الموظف";
const CFG: Record<Kind, { title: string; add: string; no: string; prefix: string; fields: Field[] }> = {
  advances: {
    title: "السلف", add: "تسجيل سلفة", no: "رقم السلفة", prefix: "S-",
    fields: [
      { k: "رقم السلفة" }, { k: "النوع", type: "select", opts: ["سلفة", "مخالفة"] }, { k: "تاريخ السلفة", type: "date" }, { k: "شهر الخصم", type: "month" }, { k: "المبلغ", type: "number" },
      { k: "المسدد", type: "number" }, { k: "السبب" }, { k: "الحالة", type: "select", opts: ["نشطة", "مغلقة"] },
    ],
  },
  commissions: {
    title: "العمولات", add: "تسجيل عمولة", no: "رقم العمولة", prefix: "C-",
    fields: [
      { k: "رقم العمولة" }, { k: "نوع العمولة" }, { k: "تاريخ الاستحقاق", type: "date" }, { k: "شهر الصرف", type: "month" },
      { k: "المبلغ", type: "number" }, { k: "الحالة", type: "select", opts: ["معتمدة", "قيد المراجعة", "مسودة"] },
      { k: "ملاحظات" },
    ],
  },
};

const n = (v: unknown) => Number(v) || 0;
const sar = (v: number) => `${v.toLocaleString("en-US")} ريال`;
const tone: Record<string, string> = {
  "نشطة": "bg-primary/15 text-primary", "معتمدة": "bg-primary/15 text-primary",
  "قيد المراجعة": "bg-accent text-accent-foreground", "مغلقة": "bg-muted text-muted-foreground", "مسودة": "bg-secondary text-secondary-foreground",
};

export function AdvancesCommissions({ empId, canEdit }: { empId: string; canEdit: boolean }) {
  const [rows, setRows] = useState<Record<Kind, Row[]>>({ advances: [], commissions: [] });
  const [edit, setEdit] = useState<{ kind: Kind; id: string; d: Record<string, string>; view: boolean } | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("hr_records").select("id,sheet,data").in("sheet", ["advances", "commissions"]).order("sort");
    if (error) { toast.error("تعذر تحميل السلف والعمولات"); return; }
    let list0 = (data ?? []) as unknown as (Row & { sheet: Kind })[];
    if (canEdit) {
      // Sales commissions are computed from the deal and added here automatically (one row per deal).
      const { data: deals } = await supabase.from("sales_deals").select("id,client,project,contract_value,commission_rate,shared,my_share,request").gt("contract_value", 0);
      const mine = (deals ?? []).filter((d) => String((d.request as Record<string, unknown> | null)?.["owner_emp"] ?? "") === empId);
      let changed = false;
      for (const d of mine) {
        const no = `SAL-${d.id.slice(0, 6)}`, amount = Math.round(commissionDue(d) * 100) / 100;
        const ex = list0.find((r) => r.sheet === "commissions" && r.data["رقم العمولة"] === no);
        if (ex && n(ex.data["المبلغ"]) === amount) continue;
        changed = true;
        if (ex) await supabase.from("hr_records").update({ data: { ...ex.data, "المبلغ": amount }, updated_at: new Date().toISOString() }).eq("id", ex.id);
        else await supabase.from("hr_records").insert({ sheet: "commissions", sort: list0.length, data: { [ID]: empId, "رقم العمولة": no, "نوع العمولة": `عمولة مبيعات — ${d.client} / ${d.project}`, "تاريخ الاستحقاق": new Date().toISOString().slice(0, 10), "شهر الصرف": new Date().toISOString().slice(0, 7), "المبلغ": amount, "الحالة": "قيد المراجعة" } });
      }
      if (changed) {
        const again = await supabase.from("hr_records").select("id,sheet,data").in("sheet", ["advances", "commissions"]).order("sort");
        list0 = (again.data ?? []) as unknown as (Row & { sheet: Kind })[];
      }
    }
    const list = list0.filter((r) => String(r.data[ID] ?? "") === empId);
    setRows({ advances: list.filter((r) => r.sheet === "advances"), commissions: list.filter((r) => r.sheet === "commissions") });
  }, [empId, canEdit]);
  useEffect(() => { load(); }, [load]);

  function openNew(kind: Kind) {
    const c = CFG[kind];
    const d: Record<string, string> = Object.fromEntries(c.fields.map((f) => [f.k, f.opts?.[0] ?? ""]));
    d[c.no] = `${c.prefix}${String(rows[kind].length + 1).padStart(3, "0")}`;
    if (kind === "advances") d["المسدد"] = "0";
    const m = new Date().toISOString().slice(0, 7);
    d[kind === "advances" ? "شهر الخصم" : "شهر الصرف"] = m;
    setEdit({ kind, id: "", d, view: false });
  }
  const openRow = (kind: Kind, r: Row, view: boolean) =>
    setEdit({ kind, id: r.id, view, d: Object.fromEntries(CFG[kind].fields.map((f) => [f.k, r.data[f.k] === undefined ? "" : String(r.data[f.k])])) });

  async function save() {
    if (!edit) return;
    if (!n(edit.d["المبلغ"])) { toast.error("أدخل المبلغ"); return; }
    const data: Record<string, string | number> = { [ID]: empId };
    for (const f of CFG[edit.kind].fields) { const v = (edit.d[f.k] ?? "").trim(); if (v) data[f.k] = f.type === "number" ? n(v) : v; }
    const res = edit.id
      ? await supabase.from("hr_records").update({ data, updated_at: new Date().toISOString() }).eq("id", edit.id)
      : await supabase.from("hr_records").insert({ sheet: edit.kind, data, sort: rows[edit.kind].length });
    if (res.error) { toast.error("تعذر الحفظ"); return; }
    toast.success("تم الحفظ"); setEdit(null); load();
  }
  async function del() {
    if (!edit?.id || !confirm("حذف هذا السجل؟")) return;
    const { error } = await supabase.from("hr_records").delete().eq("id", edit.id);
    if (error) { toast.error("تعذر الحذف"); return; }
    setEdit(null); load();
  }

  const adv = rows.advances, com = rows.commissions;
  const advTotal = adv.reduce((a, r) => a + n(r.data["المبلغ"]), 0);
  const advPaid = adv.reduce((a, r) => a + n(r.data["المسدد"]), 0);
  const sumBy = (s: string) => com.filter((r) => r.data["الحالة"] === s).reduce((a, r) => a + n(r.data["المبلغ"]), 0);

  const section = (kind: Kind, icon: React.ReactNode, stats: [string, number][], cols: string[], cell: (r: Row, c: string) => React.ReactNode) => (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-display text-lg font-bold">{icon}{CFG[kind].title}</h3>
        {canEdit && <Button size="sm" onClick={() => openNew(kind)}><Plus /> {CFG[kind].add}</Button>}
      </div>
      <div className="grid grid-cols-3 divide-x divide-x-reverse divide-border rounded-lg bg-muted/40 p-3 text-center">
        {stats.map(([l, v]) => (
          <div key={l}><div className="text-xs text-muted-foreground">{l}</div><div className="mt-1 font-display text-lg font-bold text-primary">{sar(v)}</div></div>
        ))}
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border bg-muted/30 text-right text-xs text-muted-foreground">
            {cols.map((c) => <th key={c} className="p-2 font-medium">{c}</th>)}<th className="p-2 font-medium">الإجراءات</th>
          </tr></thead>
          <tbody>
            {rows[kind].map((r) => (
              <tr key={r.id} className="border-b border-border/60 last:border-0">
                {cols.map((c) => <td key={c} className="p-2">{cell(r, c)}</td>)}
                <td className="p-2"><Button size="sm" variant="outline" onClick={() => openRow(kind, r, true)}><Eye /> عرض</Button></td>
              </tr>
            ))}
            {!rows[kind].length && <tr><td colSpan={cols.length + 1} className="p-6 text-center text-muted-foreground">لا توجد سجلات</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );

  const badge = (s: unknown) => s ? <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${tone[String(s)] ?? "bg-muted"}`}>{String(s)}</span> : "—";
  const num = (v: unknown) => n(v).toLocaleString("en-US");

  return (
    <div className="space-y-4">
      {section("advances", <Coins className="size-5 text-primary" />,
        [["المسدد", advPaid], ["إجمالي السلف", advTotal], ["الرصيد المتبقي", advTotal - advPaid]],
        ["رقم السلفة", "النوع", "تاريخ السلفة", "شهر الخصم", "المبلغ", "المسدد", "المتبقي", "السبب", "الحالة"],
        (r, c) => c === "المتبقي" ? num(n(r.data["المبلغ"]) - n(r.data["المسدد"])) : c === "الحالة" ? badge(r.data[c]) : c === "المبلغ" || c === "المسدد" ? num(r.data[c]) : String(r.data[c] ?? "—"))}
      {section("commissions", <TrendingUp className="size-5 text-primary" />,
        [["العمولات المستحقة", com.reduce((a, r) => a + n(r.data["المبلغ"]), 0)], ["المعتمدة", sumBy("معتمدة")], ["قيد المراجعة", sumBy("قيد المراجعة")]],
        ["رقم العمولة", "نوع العمولة", "تاريخ الاستحقاق", "شهر الصرف", "المبلغ", "الحالة"],
        (r, c) => c === "الحالة" ? badge(r.data[c]) : c === "المبلغ" ? num(r.data[c]) : String(r.data[c] ?? "—"))}

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-lg">
          {edit && (
            <>
              <DialogHeader><DialogTitle>{edit.id ? edit.d[CFG[edit.kind].no] : CFG[edit.kind].add}</DialogTitle></DialogHeader>
              <div className="grid gap-2 sm:grid-cols-2">
                {CFG[edit.kind].fields.map((f) => (
                  <div key={f.k} className="rounded-lg border border-border p-2">
                    <div className="text-xs text-muted-foreground">{f.k}</div>
                    {edit.view ? <div className="font-medium">{edit.d[f.k] || "—"}</div> : f.type === "select" ? (
                      <select className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2 text-sm" value={edit.d[f.k]} onChange={(e) => setEdit({ ...edit, d: { ...edit.d, [f.k]: e.target.value } })}>
                        {f.opts!.map((o) => <option key={o}>{o}</option>)}
                      </select>
                    ) : (
                      <Input className="mt-1 h-8" type={f.type ?? "text"} min={f.type === "number" ? 0 : undefined} value={edit.d[f.k]} onChange={(e) => setEdit({ ...edit, d: { ...edit.d, [f.k]: e.target.value } })} />
                    )}
                  </div>
                ))}
              </div>
              {canEdit && (
                <div className="flex flex-wrap gap-2">
                  {edit.view ? (
                    <>
                      <Button variant="outline" onClick={() => setEdit({ ...edit, view: false })}><Pencil /> تعديل</Button>
                      <Button variant="outline" className="text-destructive hover:text-destructive" onClick={del}><Trash2 /> حذف</Button>
                    </>
                  ) : (
                    <>
                      <Button onClick={save}><Save /> حفظ</Button>
                      <Button variant="outline" onClick={() => setEdit(null)}><X /> إلغاء</Button>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
