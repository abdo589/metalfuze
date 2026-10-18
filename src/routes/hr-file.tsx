import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Save, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/lib/permissions";
import { importHrFile, type HrKey, type HrRow } from "@/lib/hr-file.functions";
import sheets from "@/lib/hr-sheets.json";

export const Route = createFileRoute("/hr-file")({
  head: () => ({
    meta: [
      { title: "ملف الموارد البشرية — Metal Fuze" },
      { name: "description", content: "بيانات الموظفين والوثائق والإجازات والرواتب والتقييمات من ملف الموارد البشرية." },
      { property: "og:title", content: "ملف الموارد البشرية — Metal Fuze" },
      { property: "og:description", content: "اضغط على أي سجل لعرض كل تفاصيله وتعديلها." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HrFilePage,
});

const META = sheets as Record<HrKey, { title: string; columns: string[] }>;
const TABS: HrKey[] = ["employees", "documents", "leaves", "payroll", "evaluations"];
const ID = "رقم الموظف";
const NAME = "اسم الموظف";
type Rec = { id: string; sheet: HrKey; data: HrRow; sort: number };

function show(v: unknown) {
  if (v === undefined || v === null || v === "") return "—";
  if (typeof v === "number") return v > 0 && v < 1.01 && !Number.isInteger(v) ? `${Math.round(v * 100)}%` : v.toLocaleString("en-US");
  return String(v);
}

function HrFilePage() {
  const role = useRole();
  const canEdit = role === "admin" || role === "hr";
  const [recs, setRecs] = useState<Rec[] | null>(null);
  const [tab, setTab] = useState<HrKey>("employees");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Rec | null>(null);
  const [draft, setDraft] = useState<Record<string, string> | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("hr_records").select("id,sheet,data,sort").order("sort");
    if (error) { toast.error("تعذر التحميل"); return; }
    setRecs((data ?? []) as unknown as Rec[]);
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (recs && !recs.length && canEdit) importHrFile().then((r) => r.imported && load()).catch(() => {});
  }, [recs, canEdit, load]);

  const all = recs ?? [];
  const bySheet = (k: HrKey) => all.filter((r) => r.sheet === k);
  const rows = useMemo(() => all.filter((r) => r.sheet === tab && Object.values(r.data).join(" ").includes(q)), [all, tab, q]);
  const cols = META[tab].columns.slice(0, 7);

  const open = (r: Rec) => { setSel(r); setDraft(null); };
  const startEdit = (r: Rec) => setDraft(Object.fromEntries(META[r.sheet].columns.map((c) => [c, r.data[c] === undefined ? "" : String(r.data[c])])));

  async function save() {
    if (!sel || !draft) return;
    const data: HrRow = {};
    for (const [k, v] of Object.entries(draft)) {
      const t = v.trim();
      if (!t) continue;
      const orig = sel.data[k];
      data[k] = typeof orig === "number" && !isNaN(Number(t)) ? Number(t) : t;
    }
    const res = sel.id
      ? await supabase.from("hr_records").update({ data, updated_at: new Date().toISOString() }).eq("id", sel.id)
      : await supabase.from("hr_records").insert({ sheet: sel.sheet, data, sort: bySheet(sel.sheet).length });
    if (res.error) { toast.error("تعذر الحفظ"); return; }
    toast.success("تم الحفظ");
    setSel(null); setDraft(null); load();
  }

  async function remove() {
    if (!sel?.id || !confirm("حذف هذا السجل؟")) return;
    const { error } = await supabase.from("hr_records").delete().eq("id", sel.id);
    if (error) { toast.error("تعذر الحذف"); return; }
    toast.success("تم الحذف"); setSel(null); load();
  }

  const related = (r: Rec) => {
    const id = r.data[ID] !== undefined ? String(r.data[ID]) : null;
    const name = r.data[NAME];
    return TABS.filter((k) => k !== r.sheet).map((k) => ({
      k, rows: bySheet(k).filter((x) => (id && String(x.data[ID] ?? "") === id) || (name && x.data[NAME] === name)),
    })).filter((g) => g.rows.length);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <header className="text-center">
        <h1 className="font-display text-3xl font-extrabold sm:text-4xl">ملف الموارد البشرية</h1>
        <p className="mt-1 text-sm text-muted-foreground">اضغط على أي خانة لعرض كل بياناتها{canEdit ? " وتعديلها" : ""}</p>
      </header>
      {!recs && <p className="text-center text-muted-foreground">جارٍ التحميل…</p>}
      {recs && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {TABS.map((k) => (
              <button key={k} onClick={() => { setTab(k); setQ(""); }}
                className={`rounded-xl border p-4 text-center transition ${tab === k ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-muted/40"}`}>
                <div className="text-xs text-muted-foreground">{META[k].title}</div>
                <div className="mt-1 font-display text-2xl font-bold">{bySheet(k).length}</div>
              </button>
            ))}
          </div>
          <section className="rounded-xl border border-border bg-card">
            <div className="flex gap-3 border-b border-border p-4">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث…" className="pr-9" />
              </div>
              {canEdit && (
                <Button onClick={() => { const r: Rec = { id: "", sheet: tab, data: {}, sort: 0 }; setSel(r); startEdit(r); }}>
                  <Plus /> إضافة
                </Button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-right text-xs text-muted-foreground">
                  {cols.map((c) => <th key={c} className="p-3 font-medium">{c}</th>)}
                </tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} onClick={() => open(r)} className="cursor-pointer border-b border-border/60 hover:bg-muted/40">
                      {cols.map((c) => <td key={c} className="p-3">{show(r.data[c])}</td>)}
                    </tr>
                  ))}
                  {!rows.length && <tr><td colSpan={cols.length} className="p-8 text-center text-muted-foreground">لا توجد نتائج</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
      <Dialog open={!!sel} onOpenChange={(o) => { if (!o) { setSel(null); setDraft(null); } }}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          {sel && (
            <>
              <DialogHeader>
                <DialogTitle>{sel.id ? show(sel.data[NAME] ?? sel.data[META[sel.sheet].columns[0]!]) : `إضافة — ${META[sel.sheet].title}`}</DialogTitle>
              </DialogHeader>
              {canEdit && (
                <div className="flex flex-wrap gap-2">
                  {draft ? (
                    <>
                      <Button onClick={save}><Save /> حفظ</Button>
                      {sel.id && <Button variant="outline" onClick={() => setDraft(null)}><X /> إلغاء</Button>}
                    </>
                  ) : (
                    <>
                      <Button variant="outline" onClick={() => startEdit(sel)}><Pencil /> تعديل</Button>
                      <Button variant="outline" className="text-destructive hover:text-destructive" onClick={remove}><Trash2 /> حذف</Button>
                    </>
                  )}
                </div>
              )}
              <div className="grid gap-2 sm:grid-cols-2">
                {META[sel.sheet].columns.map((c) => (
                  <div key={c} className="rounded-lg border border-border p-2">
                    <div className="text-xs text-muted-foreground">{c}</div>
                    {draft ? (
                      <Input className="mt-1 h-8" value={draft[c] ?? ""} onChange={(e) => setDraft({ ...draft, [c]: e.target.value })} />
                    ) : (
                      <div className="font-medium">{show(sel.data[c])}</div>
                    )}
                  </div>
                ))}
              </div>
              {sel.id && !draft && related(sel).map((g) => (
                <div key={g.k} className="space-y-2">
                  <h3 className="font-bold">{META[g.k].title} <Badge variant="outline">{g.rows.length}</Badge></h3>
                  {g.rows.map((r) => (
                    <button key={r.id} onClick={() => open(r)} className="block w-full rounded-lg bg-muted/40 p-2 text-start text-xs hover:bg-muted">
                      {META[g.k].columns.filter((c) => c !== ID && c !== NAME && r.data[c] !== undefined).map((c) => (
                        <span key={c} className="me-3 inline-block"><span className="text-muted-foreground">{c}:</span> {show(r.data[c])}</span>
                      ))}
                    </button>
                  ))}
                </div>
              ))}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
