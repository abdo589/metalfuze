import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FileUp, FileText, Pencil, Plus, Save, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/lib/permissions";
import { importHrFile, type HrKey, type HrRow } from "@/lib/hr-file.functions";
import sheets from "@/lib/hr-sheets.json";
import { Residencies } from "@/components/ResidenciesPanel";
import { NationalitySelect } from "@/components/NationalitySelect";
import { STATUS_OPTIONS, endedLabel } from "@/lib/employee-status";

export const Route = createFileRoute("/hr-file")({
  head: () => ({
    meta: [
      { title: "بيانات الموظفين — Metal Fuze" },
      { name: "description", content: "بيانات الموظفين والوثائق والإجازات والرواتب والتقييمات من ملف الموارد البشرية." },
      { property: "og:title", content: "بيانات الموظفين — Metal Fuze" },
      { property: "og:description", content: "اضغط على أي سجل لعرض كل تفاصيله وتعديلها." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HrFilePage,
});

const META = sheets as Record<HrKey, { title: string; columns: string[] }>;
const TABS: HrKey[] = ["employees", "documents", "leaves", "payroll", "evaluations"];
/** Leaves have their own page (/leaves), so they are not offered as a box here. */
const GRID: HrKey[] = TABS.filter((k) => k !== "leaves");
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
  const [resTab, setResTab] = useState(false);
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
    if (recs && !recs.length && canEdit) importHrFile().then((r) => { if (r.imported) load(); }).catch(() => {});
  }, [recs, canEdit, load]);

  const all = recs ?? [];
  const bySheet = (k: HrKey) => all.filter((r) => r.sheet === k);
  const rows = useMemo(() => all.filter((r) => r.sheet === tab && Object.values(r.data).join(" ").includes(q)), [all, tab, q]);
  const cols = META[tab].columns.slice(0, 7);

  const open = (r: Rec) => { setSel(r); setDraft(null); };
  const startEdit = (r: Rec) => setDraft(Object.fromEntries(META[r.sheet].columns.map((c) => [c, r.data[c] === undefined ? "" : String(r.data[c])])));

  async function save() {
    if (!sel || !draft) return;
    const data: HrRow = Object.fromEntries(Object.entries(sel.data).filter(([k]) => !META[sel.sheet].columns.includes(k)));
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
        <h1 className="font-display text-3xl font-extrabold sm:text-4xl">بيانات الموظفين</h1>
        <p className="mt-1 text-sm text-muted-foreground">اضغط على أي خانة لعرض كل بياناتها{canEdit ? " وتعديلها" : ""}</p>
      </header>
      {!recs && <p className="text-center text-muted-foreground">جارٍ التحميل…</p>}
      {recs && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
            {GRID.map((k) => (
              <button key={k} onClick={() => { setTab(k); setQ(""); setResTab(false); }}
                className={`rounded-xl border p-4 text-center transition ${!resTab && tab === k ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-muted/40"}`}>
                <div className="text-xs text-muted-foreground">{META[k].title}</div>
                <div className="mt-1 font-display text-2xl font-bold">{bySheet(k).length}</div>
              </button>
            ))}
            <button onClick={() => setResTab(true)}
              className={`rounded-xl border p-4 text-center transition ${resTab ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-muted/40"}`}>
              <div className="text-xs text-muted-foreground">الإقامات</div>
              <div className="mt-1 font-display text-2xl font-bold">🪪</div>
            </button>
          </div>
          {resTab ? <Residencies /> : <section className="rounded-xl border border-border bg-card">
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
                  {canEdit && <th className="p-3 font-medium">تعديل</th>}
                </tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} onClick={() => open(r)} className={`cursor-pointer border-b border-border/60 hover:bg-muted/40 ${sheet === "employees" && endedLabel(r.data["الحالة"]) ? "bg-destructive/10 opacity-80" : ""}`}>
                      {cols.map((c) => (
                        <td key={c} className="p-3">
                          {show(r.data[c])}
                          {c === "اسم الموظف" && sheet === "employees" && endedLabel(r.data["الحالة"]) && (
                            <span className="ms-2 inline-block rounded-full bg-destructive px-2 py-0.5 text-[10px] font-semibold text-destructive-foreground">{endedLabel(r.data["الحالة"])}</span>
                          )}
                        </td>
                      ))}
                      {canEdit && (
                        <td className="p-3">
                          <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setSel(r); startEdit(r); }}>
                            <Pencil /> تعديل
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {!rows.length && <tr><td colSpan={cols.length + (canEdit ? 1 : 0)} className="p-8 text-center text-muted-foreground">لا توجد نتائج</td></tr>}
                </tbody>
              </table>
            </div>
          </section>}
        </>
      )}
      <Dialog open={!!sel} onOpenChange={(o) => { if (!o) { setSel(null); setDraft(null); } }}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          {sel && (
            <>
              <DialogHeader>
                <DialogTitle>{sel.id ? show(sel.data[NAME] ?? sel.data[META[sel.sheet].columns[0]!]) : `إضافة — ${META[sel.sheet].title}`}</DialogTitle>
              </DialogHeader>
              {sel.id && sel.sheet === "employees" && (
                <ContractBox rec={sel} canEdit={canEdit} onChange={(d) => { setSel({ ...sel, data: d }); load(); }} />
              )}
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
                      c === "الجنسية" ? (
                        <NationalitySelect className="mt-1" value={draft[c] ?? ""} onChange={(v) => setDraft({ ...draft, [c]: v })} />
                      ) : c === "الحالة" && sel.sheet === "employees" ? (
                        <select className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground" value={draft[c] ?? ""} onChange={(e) => setDraft({ ...draft, [c]: e.target.value })}>
                          <option value="">—</option>
                          {draft[c] && !STATUS_OPTIONS.includes(draft[c]!) && <option value={draft[c]}>{draft[c]}</option>}
                          {STATUS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (
                        <Input className="mt-1 h-8" value={draft[c] ?? ""} onChange={(e) => setDraft({ ...draft, [c]: e.target.value })} />
                      )
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

const CONTRACT = "عقد العمل";
function ContractBox({ rec, canEdit, onChange }: { rec: Rec; canEdit: boolean; onChange: (d: HrRow) => void }) {
  const [busy, setBusy] = useState(false);
  const path = rec.data[CONTRACT] ? String(rec.data[CONTRACT]) : "";
  async function upload(f: File) {
    setBusy(true);
    const ext = f.name.split(".").pop() || "pdf";
    const p = `contracts/${rec.id}-${Date.now()}.${ext}`;
    const up = await supabase.storage.from("employee-files").upload(p, f);
    if (up.error) { setBusy(false); toast.error("تعذر رفع الملف"); return; }
    if (path) await supabase.storage.from("employee-files").remove([path]);
    const data = { ...rec.data, [CONTRACT]: p };
    const { error } = await supabase.from("hr_records").update({ data, updated_at: new Date().toISOString() }).eq("id", rec.id);
    setBusy(false);
    if (error) { toast.error("تعذر الحفظ"); return; }
    toast.success("تم رفع عقد العمل"); onChange(data);
  }
  async function view() {
    const { data, error } = await supabase.storage.from("employee-files").createSignedUrl(path, 300);
    if (error || !data) { toast.error("تعذر فتح الملف"); return; }
    window.open(data.signedUrl, "_blank");
  }
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3">
      <FileText className="size-4 text-primary" />
      <span className="font-medium">عقد العمل:</span>
      {path ? <Button size="sm" variant="outline" onClick={view}>عرض العقد</Button> : <span className="text-sm text-muted-foreground">لم يُرفع بعد</span>}
      {canEdit && (
        <Button size="sm" variant="outline" disabled={busy} asChild>
          <label className="cursor-pointer">
            <FileUp /> {busy ? "جارٍ الرفع…" : path ? "استبدال العقد" : "رفع العقد"}
            <input type="file" accept=".pdf,image/*,.doc,.docx" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
          </label>
        </Button>
      )}
    </div>
  );
}
