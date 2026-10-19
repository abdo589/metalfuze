import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Eye, FileUp, FileText, Pencil, Plus, Save, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/lib/permissions";
import { importHrFile, type HrKey, type HrRow } from "@/lib/hr-file.functions";
import sheets from "@/lib/hr-sheets.json";
import { DocsOverview } from "@/components/DocsOverview";
import { NationalitySelect } from "@/components/NationalitySelect";
import { resolveEmployeeStatus, statusLabel, statusOptions } from "@/lib/employee-status";
import { useLanguage } from "@/lib/i18n";

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
  const lang = useLanguage();
  const canEdit = role === "hr";
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {GRID.map((k) => (
              <button key={k} onClick={() => { setTab(k); setQ(""); setResTab(false); }}
                className={`rounded-xl border p-4 text-center transition ${!resTab && tab === k ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-muted/40"}`}>
                <div className="text-xs text-muted-foreground">{META[k].title}</div>
                <div className="mt-1 font-display text-2xl font-bold">{bySheet(k).length}</div>
              </button>
            ))}
          </div>
          {tab === "documents" && <DocsOverview rows={bySheet("documents")} />}
          {<section className="rounded-xl border border-border bg-card">
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
                  <th className="p-3 font-medium">عرض</th>
                </tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} onClick={() => open(r)} className={`cursor-pointer border-b border-border/60 hover:bg-muted/40 ${r.sheet === "employees" && statusLabel(r.data["حالة الموظف"] ?? r.data["الحالة"], lang) ? "bg-destructive/10 opacity-80" : ""}`}>
                      {cols.map((c) => (
                        <td key={c} className="p-3">
                          {show(r.data[c])}
                          {c === "اسم الموظف" && r.sheet === "employees" && statusLabel(r.data["حالة الموظف"] ?? r.data["الحالة"], lang) && (
                            <span className="ms-2 inline-block rounded-full bg-destructive px-2 py-0.5 text-[10px] font-semibold text-destructive-foreground">{statusLabel(r.data["حالة الموظف"] ?? r.data["الحالة"], lang)}</span>
                          )}
                        </td>
                      ))}
                      <td className="p-3">
                        <Button variant="outline" size="icon" aria-label="عرض" onClick={(e) => { e.stopPropagation(); open(r); }}>
                          <Eye />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {!rows.length && <tr><td colSpan={cols.length + 1} className="p-8 text-center text-muted-foreground">لا توجد نتائج</td></tr>}
                </tbody>
              </table>
            </div>
          </section>}
        </>
      )}
      <Dialog open={!!sel} onOpenChange={(o) => { if (!o) { setSel(null); setDraft(null); setPtab("basic"); } }}>
        <DialogContent className={`max-h-[90vh] overflow-y-auto ${sel?.sheet === "employees" && sel.id ? "max-w-5xl" : "max-w-2xl"}`}>
          {sel && (() => {
            const isEmp = sel.sheet === "employees" && !!sel.id;
            const rel = sel.id ? related(sel) : [];
            const st = sel.data["حالة الموظف"] ?? sel.data["الحالة"];
            const inactive = statusLabel(st, lang);
            const ptabs: [string, string][] = isEmp
              ? [["basic", "البيانات الأساسية"], ["files", "العقد والمستندات"], ...rel.map((g) => [g.k, META[g.k].title] as [string, string]), ["money", "السلف والعمولات"]]
              : [];
            const cur = isEmp ? ptab : "basic";
            return (
            <>
              {isEmp ? (
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="grid size-16 place-items-center rounded-full bg-muted"><UserRound className="size-8 text-primary" /></div>
                    <div className="space-y-0.5 text-sm">
                      <DialogHeader><DialogTitle className="font-display text-2xl">{show(sel.data[NAME])}</DialogTitle></DialogHeader>
                      <div><span className="text-muted-foreground">رقم الموظف: </span>{show(sel.data[ID])}</div>
                      <div><span className="text-muted-foreground">المسمى الوظيفي: </span>{show(sel.data["المسمى الوظيفي"])}</div>
                      <div><span className="text-muted-foreground">الإدارة: </span>{show(sel.data["القسم"])}</div>
                    </div>
                  </div>
                  <span className={`me-8 rounded-full px-3 py-1 text-xs font-semibold ${inactive ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"}`}>● {inactive || show(st) === "—" ? (inactive || "على رأس العمل") : show(st)}</span>
                </div>
              ) : (
                <DialogHeader>
                  <DialogTitle>{sel.id ? show(sel.data[NAME] ?? sel.data[META[sel.sheet].columns[0]!]) : `إضافة — ${META[sel.sheet].title}`}</DialogTitle>
                </DialogHeader>
              )}
              {isEmp && (
                <div className="flex flex-wrap gap-2 border-b border-border pb-3">
                  {ptabs.map(([k, l]) => (
                    <button key={k} onClick={() => { setPtab(k); setDraft(null); }}
                      className={`rounded-lg border px-4 py-2 text-sm transition ${cur === k ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted/50"}`}>{l}</button>
                  ))}
                </div>
              )}
              {isEmp && cur === "files" && (
                <>
                  <ContractBox rec={sel} canEdit={canEdit} onChange={(d) => { setSel({ ...sel, data: d }); load(); }} />
                  <CertificatesBox rec={sel} canEdit={canEdit} onChange={(d) => { setSel({ ...sel, data: d }); load(); }} />
                  {([["مباشرة العمل", "work-start"], ["العرض الوظيفي", "job-offers"], ["إقرار عدم الإفصاح", "nda"]] as const).map(([f, folder]) => (
                    <ContractBox key={f} rec={sel} canEdit={canEdit} field={f} label={f} folder={folder} onChange={(d) => { setSel({ ...sel, data: d }); load(); }} />
                  ))}
                </>
              )}
              {isEmp && cur === "money" && <AdvancesCommissions empId={String(sel.data[ID] ?? sel.id)} canEdit={canEdit} />}
              {cur === "basic" && (
                <>
              {sel.id && (
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => downloadPerson(sel, rel).catch(() => toast.error("تعذر التحميل"))}><Download /> Excel</Button>
                  <Button variant="outline" onClick={() => downloadPersonPdf(sel, rel).then(() => toast.success("تم حفظ PDF")).catch(() => toast.error("تعذر حفظ PDF"))}><FileText /> PDF</Button>
                </div>
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
              <div className={`grid gap-2 sm:grid-cols-2 ${isEmp ? "lg:grid-cols-3" : ""}`}>
                {META[sel.sheet].columns.map((c) => (
                  <div key={c} className="rounded-lg border border-border p-2">
                    <div className="text-xs text-muted-foreground">{c}</div>
                    {draft ? (
                      c === "الجنسية" ? (
                        <NationalitySelect className="mt-1" value={draft[c] ?? ""} onChange={(v) => setDraft({ ...draft, [c]: v })} />
                      ) : (c === "الحالة" || c === "حالة الموظف") && sel.sheet === "employees" ? (
                        <select className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground" value={resolveEmployeeStatus(draft[c])?.ar ?? draft[c] ?? ""} onChange={(e) => setDraft({ ...draft, [c]: e.target.value })}>
                          <option value="">{lang === "en" ? "Select status" : "اختر الحالة"}</option>
                          {draft[c] && !resolveEmployeeStatus(draft[c]) && <option value={draft[c]}>{draft[c]}</option>}
                          {statusOptions(lang).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
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
                </>
              )}
              {sel.id && !draft && rel.filter((g) => !isEmp || cur === g.k).map((g) => (
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
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

async function downloadPerson(r: Rec, rel: { k: HrKey; rows: Rec[] }[]) {
  const { exportBrandedExcel } = await import("@/lib/branded-excel");
  const groups = [{ k: r.sheet, rows: [r] }, ...rel];
  const name = String(r.data[NAME] ?? "موظف");
  await exportBrandedExcel({
    filename: `ملف-${name}.xlsx`,
    reportTitle: `ملف الموظف — ${name}`,
    sheets: groups.map((g) => ({
      name: META[g.k].title.slice(0, 30),
      title: META[g.k].title,
      columns: META[g.k].columns.map((c) => ({ header: c, width: 18 })),
      rows: g.rows.map((x) => META[g.k].columns.map((c) => { const v = x.data[c]; return v === undefined || v === null ? "" : typeof v === "number" ? v : String(v); })),
    })),
  });
}

async function downloadPersonPdf(r: Rec, rel: { k: HrKey; rows: Rec[] }[]) {
  const { exportElementPdf } = await import("@/lib/pdf");
  const logo = (await import("@/assets/metal-fuze-logo.png.asset.json")).default.url;
  const name = String(r.data[NAME] ?? "موظف");
  const esc = (v: unknown) => String(v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const groups = [{ k: r.sheet, rows: [r] }, ...rel];
  const el = document.createElement("div");
  el.dir = "rtl";
  el.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;padding:28px;background:#fff;color:#1a2b2c;font-family:Tajawal,Arial,sans-serif;font-size:12px";
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #1f6b70;padding-bottom:12px;margin-bottom:16px">
      <div><div style="font-size:22px;font-weight:800;color:#1f6b70">ملف الموظف</div><div style="font-size:16px;font-weight:700;margin-top:4px">${esc(name)}</div>
      <div style="color:#667;margin-top:4px">${new Date().toLocaleDateString("ar-SA-u-ca-gregory", { dateStyle: "long" })}</div></div>
      <img src="${logo}" crossorigin="anonymous" style="height:64px" />
    </div>
    ${groups.map((g) => `
      <div style="margin-bottom:16px">
        <div style="background:#1f6b70;color:#fff;font-weight:700;padding:6px 10px;border-radius:6px 6px 0 0">${esc(META[g.k].title)}</div>
        ${g.rows.map((x) => `<table style="width:100%;border-collapse:collapse;margin-bottom:6px">${
          META[g.k].columns.filter((c) => x.data[c] !== undefined && x.data[c] !== "").reduce<string[][]>((a, c, i) => { if (i % 2 === 0) a.push([c]); else a[a.length - 1]!.push(c); return a; }, [])
            .map((pair, i) => `<tr style="background:${i % 2 ? "#f1f8f7" : "#fff"}">${pair.map((c) => `<td style="border:1px solid #cfdcdb;padding:5px 8px;width:22%;color:#556;font-weight:600">${esc(c)}</td><td style="border:1px solid #cfdcdb;padding:5px 8px;width:28%">${esc(show(x.data[c]))}</td>`).join("")}${pair.length < 2 ? '<td style="border:1px solid #cfdcdb"></td><td style="border:1px solid #cfdcdb"></td>' : ""}</tr>`).join("")
        }</table>`).join("")}
      </div>`).join("")}`;
  document.body.appendChild(el);
  try { await exportElementPdf(el, `ملف-${name}.pdf`); } finally { el.remove(); }
}

/** Open a private file: open the tab synchronously (popup blockers), then point it at a signed URL. */
async function openFile(path: string) {
  const w = window.open("", "_blank");
  const { data, error } = await supabase.storage.from("employee-files").createSignedUrl(path, 30);
  if (error || !data) { w?.close(); toast.error("تعذر فتح الملف"); return; }
  if (w) w.location.href = data.signedUrl; else window.location.href = data.signedUrl;
}

type Cert = { path: string; name: string };
const CERTS = "الشهادات";
function readCerts(v: unknown): Cert[] {
  if (!v) return [];
  try { const a = JSON.parse(String(v)); if (Array.isArray(a)) return a.filter((x) => x?.path); } catch { /* legacy single path */ }
  return [{ path: String(v), name: "شهادة" }];
}

function CertificatesBox({ rec, canEdit, onChange }: { rec: Rec; canEdit: boolean; onChange: (d: HrRow) => void }) {
  const [busy, setBusy] = useState(false);
  const certs = readCerts(rec.data[CERTS]);
  async function persist(list: Cert[]) {
    const data = { ...rec.data, [CERTS]: JSON.stringify(list) };
    const { error } = await supabase.from("hr_records").update({ data, updated_at: new Date().toISOString() }).eq("id", rec.id);
    if (error) { toast.error("تعذر الحفظ"); return false; }
    onChange(data); return true;
  }
  async function upload(files: File[]) {
    setBusy(true);
    const added: Cert[] = [];
    for (const f of files) {
      const ext = f.name.split(".").pop() || "pdf";
      const p = `certificates/${rec.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
      const up = await supabase.storage.from("employee-files").upload(p, f);
      if (up.error) { toast.error(`تعذر رفع ${f.name}`); continue; }
      added.push({ path: p, name: f.name });
    }
    if (added.length && await persist([...certs, ...added])) toast.success(`تم رفع ${added.length} شهادة`);
    setBusy(false);
  }
  async function del(c: Cert) {
    if (!confirm(`حذف ${c.name}؟`)) return;
    await supabase.storage.from("employee-files").remove([c.path]);
    if (await persist(certs.filter((x) => x.path !== c.path))) toast.success("تم الحذف");
  }
  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <FileText className="size-4 text-primary" />
        <span className="font-medium">الشهادات ({certs.length})</span>
        {canEdit && (
          <Button size="sm" variant="outline" disabled={busy} asChild>
            <label className="cursor-pointer">
              <FileUp /> {busy ? "جارٍ الرفع…" : "إضافة شهادات"}
              <input type="file" multiple accept=".pdf,image/*,.doc,.docx" className="hidden"
                onChange={(e) => { const fs = Array.from(e.target.files ?? []); if (fs.length) upload(fs); e.target.value = ""; }} />
            </label>
          </Button>
        )}
      </div>
      {!certs.length && <p className="text-sm text-muted-foreground">لا توجد شهادات بعد</p>}
      {certs.map((c) => (
        <div key={c.path} className="flex items-center gap-2 rounded-md bg-muted/40 px-2 py-1 text-sm">
          <span className="flex-1 truncate">{c.name}</span>
          <Button size="sm" variant="ghost" onClick={() => openFile(c.path)}><Eye /> عرض</Button>
          {canEdit && <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => del(c)}><Trash2 /></Button>}
        </div>
      ))}
    </div>
  );
}

function ContractBox({ rec, canEdit, onChange, field = "عقد العمل", label = "عقد العمل", folder = "contracts" }: { rec: Rec; canEdit: boolean; onChange: (d: HrRow) => void; field?: string; label?: string; folder?: string }) {
  const CONTRACT = field;
  const [busy, setBusy] = useState(false);
  const path = rec.data[CONTRACT] ? String(rec.data[CONTRACT]) : "";
  async function upload(f: File) {
    setBusy(true);
    const ext = f.name.split(".").pop() || "pdf";
    const p = `${folder}/${rec.id}-${Date.now()}.${ext}`;
    const up = await supabase.storage.from("employee-files").upload(p, f);
    if (up.error) { setBusy(false); toast.error("تعذر رفع الملف"); return; }
    if (path) await supabase.storage.from("employee-files").remove([path]);
    const data = { ...rec.data, [CONTRACT]: p };
    const { error } = await supabase.from("hr_records").update({ data, updated_at: new Date().toISOString() }).eq("id", rec.id);
    setBusy(false);
    if (error) { toast.error("تعذر الحفظ"); return; }
    toast.success(`تم رفع ${label}`); onChange(data);
  }
  const view = () => openFile(path);
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3">
      <FileText className="size-4 text-primary" />
      <span className="font-medium">{label}:</span>
      {path ? <Button size="sm" variant="outline" onClick={view}>عرض الملف</Button> : <span className="text-sm text-muted-foreground">لم يُرفع بعد</span>}
      {canEdit && (
        <Button size="sm" variant="outline" disabled={busy} asChild>
          <label className="cursor-pointer">
            <FileUp /> {busy ? "جارٍ الرفع…" : path ? `استبدال ${label}` : `رفع ${label}`}
            <input type="file" accept=".pdf,image/*,.doc,.docx" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
          </label>
        </Button>
      )}
    </div>
  );
}
