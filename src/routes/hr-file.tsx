import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getHrFile, type HrFile, type HrSheet } from "@/lib/hr-file.functions";

export const Route = createFileRoute("/hr-file")({
  head: () => ({
    meta: [
      { title: "ملف الموارد البشرية — Metal Fuze" },
      { name: "description", content: "بيانات الموظفين والوثائق والإجازات والرواتب والتقييمات من ملف الموارد البشرية." },
      { property: "og:title", content: "ملف الموارد البشرية — Metal Fuze" },
      { property: "og:description", content: "اضغط على أي سجل لعرض كل تفاصيله." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HrFilePage,
});

type Key = keyof HrFile;
const TABS: Key[] = ["employees", "documents", "leaves", "payroll", "evaluations"];
const ID = "رقم الموظف";
const NAME = "اسم الموظف";

function show(v: unknown) {
  if (v === undefined || v === null || v === "") return "—";
  if (typeof v === "number") return v > 0 && v < 1.01 && !Number.isInteger(v) ? `${Math.round(v * 100)}%` : v.toLocaleString("en-US");
  return String(v);
}

function HrFilePage() {
  const [data, setData] = useState<HrFile | null>(null);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState<Key>("employees");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<{ sheet: Key; row: Record<string, string | number> } | null>(null);

  useEffect(() => { getHrFile().then(setData).catch((e) => setErr(String(e.message ?? e))); }, []);

  const sheet: HrSheet | undefined = data?.[tab];
  const rows = useMemo(() => (sheet?.rows ?? []).filter((r) => Object.values(r).join(" ").includes(q)), [sheet, q]);
  const cols = (sheet?.columns ?? []).slice(0, 7);

  const related = (row: Record<string, string | number>) => {
    if (!data) return [];
    const id = row[ID] ? String(row[ID]) : null;
    const name = row[NAME];
    return TABS.filter((k) => k !== sel?.sheet).map((k) => ({
      k, title: data[k].title,
      rows: data[k].rows.filter((r) => (id && String(r[ID] ?? "") === id) || (name && r[NAME] === name)),
    })).filter((x) => x.rows.length);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <header className="text-center">
        <h1 className="font-display text-3xl font-extrabold sm:text-4xl">ملف الموارد البشرية</h1>
        <p className="mt-1 text-sm text-muted-foreground">اضغط على أي خانة لعرض كل بياناتها</p>
      </header>
      {err && <p className="text-center text-destructive">{err}</p>}
      {!data && !err && <p className="text-center text-muted-foreground">جارٍ التحميل…</p>}
      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {TABS.map((k) => (
              <button key={k} onClick={() => { setTab(k); setQ(""); }}
                className={`rounded-xl border p-4 text-center transition ${tab === k ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-muted/40"}`}>
                <div className="text-xs text-muted-foreground">{data[k].title}</div>
                <div className="mt-1 font-display text-2xl font-bold">{data[k].rows.length}</div>
              </button>
            ))}
          </div>
          <section className="rounded-xl border border-border bg-card">
            <div className="border-b border-border p-4">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث…" className="pr-9" />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-right text-xs text-muted-foreground">
                  {cols.map((c) => <th key={c} className="p-3 font-medium">{c}</th>)}
                </tr></thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} onClick={() => setSel({ sheet: tab, row: r })} className="cursor-pointer border-b border-border/60 hover:bg-muted/40">
                      {cols.map((c) => <td key={c} className="p-3">{show(r[c])}</td>)}
                    </tr>
                  ))}
                  {!rows.length && <tr><td colSpan={cols.length} className="p-8 text-center text-muted-foreground">لا توجد نتائج</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
      <Dialog open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          {sel && data && (
            <>
              <DialogHeader><DialogTitle>{show(sel.row[NAME] ?? sel.row[data[sel.sheet].columns[0]!])}</DialogTitle></DialogHeader>
              <div className="grid gap-2 sm:grid-cols-2">
                {data[sel.sheet].columns.map((c) => (
                  <div key={c} className="rounded-lg border border-border p-2">
                    <div className="text-xs text-muted-foreground">{c}</div>
                    <div className="font-medium">{show(sel.row[c])}</div>
                  </div>
                ))}
              </div>
              {related(sel.row).map((g) => (
                <div key={g.k} className="space-y-2">
                  <h3 className="font-bold">{g.title} <Badge variant="outline">{g.rows.length}</Badge></h3>
                  {g.rows.map((r, i) => (
                    <div key={i} className="rounded-lg bg-muted/40 p-2 text-xs">
                      {data[g.k].columns.filter((c) => c !== ID && c !== NAME && r[c] !== undefined).map((c) => (
                        <span key={c} className="me-3 inline-block"><span className="text-muted-foreground">{c}:</span> {show(r[c])}</span>
                      ))}
                    </div>
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
