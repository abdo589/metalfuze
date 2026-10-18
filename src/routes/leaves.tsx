import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarOff, FileSpreadsheet, Pencil, Plus, Save, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/lib/permissions";
import { importHrFile, type HrRow } from "@/lib/hr-file.functions";
import { locale, t } from "@/lib/i18n";
import {
  LEAVE_COLS, daysInMonth, leaveDays, leaveStatus, localDay, toIso, type LeaveStatus,
} from "@/lib/leave";

export const Route = createFileRoute("/leaves")({
  head: () => ({
    meta: [
      { title: "الإجازات — Metal Fuze" },
      { name: "description", content: "إجازات موظفي Metal Fuze: من في إجازة الآن، والإجازات القادمة، وأيام كل موظف." },
      { property: "og:title", content: "الإجازات — Metal Fuze" },
      { property: "og:description", content: "لوحة إجازات الموظفين: حالة كل إجازة وأيامها لكل شهر." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LeavesPage,
});

type Rec = { id: string; sheet: string; data: HrRow; sort: number };
type Row = Rec & { start: string | null; end: string | null; status: LeaveStatus | null; days: number };

const NAME = "اسم الموظف";
const DEPT = "القسم";
const TYPE = "نوع الإجازة";
const FROM = "تاريخ البداية";
const TO = "تاريخ النهاية";
const N = "عدد الأيام";
const STATE = "الحالة";
const NOTE = "ملاحظات";

const ST: Record<LeaveStatus, string> = { active: "جارية", upcoming: "قادمة", ended: "منتهية" };
const ST_TONE: Record<LeaveStatus, string> = {
  active: "border-primary/50 bg-primary/10 text-primary",
  upcoming: "border-border bg-muted/40 text-foreground",
  ended: "border-border bg-card text-muted-foreground",
};

function show(v: unknown) {
  if (v === undefined || v === null || v === "") return "—";
  if (typeof v === "number") return v.toLocaleString("en-US");
  return String(v);
}

function LeavesPage() {
  const role = useRole();
  const canEdit = role === "admin" || role === "hr";
  const [recs, setRecs] = useState<Rec[] | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | LeaveStatus>("all");
  const [type, setType] = useState("all");
  const [sel, setSel] = useState<Rec | null>(null);
  const [draft, setDraft] = useState<Record<string, string> | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("hr_records").select("id,sheet,data,sort").eq("sheet", "leaves").order("sort");
    if (error) { toast.error(t("تعذر التحميل")); return; }
    setRecs((data ?? []) as unknown as Rec[]);
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (recs && !recs.length && canEdit) importHrFile().then((r) => { if (r.imported) load(); }).catch(() => {});
  }, [recs, canEdit, load]);

  const today = localDay();
  const month = today.slice(0, 7);

  const rows = useMemo<Row[]>(() => (recs ?? []).map((r) => ({
    ...r,
    start: toIso(r.data[FROM]),
    end: toIso(r.data[TO]),
    status: leaveStatus(r.data[FROM], r.data[TO], today),
    days: leaveDays(r.data[FROM], r.data[TO], r.data[N]),
  })), [recs, today]);

  const types = useMemo(() => [...new Set(rows.map((r) => String(r.data[TYPE] ?? "")).filter(Boolean))].sort(), [rows]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (status !== "all" && r.status !== status) return false;
    if (type !== "all" && String(r.data[TYPE] ?? "") !== type) return false;
    const text = `${r.data[NAME] ?? ""} ${r.data[DEPT] ?? ""} ${r.data[TYPE] ?? ""} ${r.data[NOTE] ?? ""}`;
    return !q || text.includes(q);
  }).sort((a, b) => (a.start ?? "9999").localeCompare(b.start ?? "9999")), [rows, status, type, q]);

  const onNow = rows.filter((r) => r.status === "active").length;
  const upcoming = rows.filter((r) => r.status === "upcoming").length;
  const ended = rows.filter((r) => r.status === "ended").length;
  const totalDays = rows.reduce((s, r) => s + r.days, 0);
  const monthDays = rows.reduce((s, r) => s + daysInMonth(r.data[FROM], r.data[TO], month), 0);

  const year = today.slice(0, 4);
  const byMonth = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const m = `${year}-${String(i + 1).padStart(2, "0")}`;
    return { m, days: rows.reduce((s, r) => s + daysInMonth(r.data[FROM], r.data[TO], m), 0) };
  }), [rows, year]);
  const maxMonth = Math.max(1, ...byMonth.map((b) => b.days));

  const byEmp = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) { const k = String(r.data[NAME] ?? "—"); m.set(k, (m.get(k) ?? 0) + r.days); }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [rows]);
  const maxEmp = Math.max(1, ...byEmp.map((e) => e[1]));

  const open = (r: Rec) => { setSel(r); setDraft(null); };
  const startEdit = (r: Rec) => setDraft(Object.fromEntries(LEAVE_COLS.map((c) => [c, r.data[c] === undefined ? "" : String(r.data[c])])));

  async function save() {
    if (!sel || !draft) return;
    const data: HrRow = Object.fromEntries(Object.entries(sel.data).filter(([k]) => !LEAVE_COLS.includes(k)));
    for (const [k, v] of Object.entries(draft)) {
      const s = v.trim();
      if (!s) continue;
      const orig = sel.data[k];
      data[k] = typeof orig === "number" && !isNaN(Number(s)) ? Number(s) : s;
    }
    const res = sel.id
      ? await supabase.from("hr_records").update({ data, updated_at: new Date().toISOString() }).eq("id", sel.id)
      : await supabase.from("hr_records").insert({ sheet: "leaves", data, sort: rows.length });
    if (res.error) { toast.error(t("تعذر الحفظ")); return; }
    toast.success(t("تم الحفظ"));
    setSel(null); setDraft(null); load();
  }

  async function remove() {
    if (!sel?.id || !confirm(t("حذف هذا السجل؟"))) return;
    const { error } = await supabase.from("hr_records").delete().eq("id", sel.id);
    if (error) { toast.error(t("تعذر الحذف")); return; }
    toast.success(t("تم الحذف")); setSel(null); load();
  }

  async function exportExcel() {
    try {
      const { exportBrandedExcel } = await import("@/lib/branded-excel");
      await exportBrandedExcel({
        filename: `${locale() === "en-GB" ? "Leaves" : "الإجازات"}-${today}.xlsx`,
        reportTitle: `${t("الإجازات")} — ${today}`,
        summary: [
          [t("سجلات الإجازات"), filtered.length, "int"],
          [t("في إجازة الآن"), onNow, "int"],
          [t("إجازات قادمة"), upcoming, "int"],
          [t("إجمالي أيام الإجازات"), totalDays, "int"],
        ],
        sheets: [{
          name: t("الإجازات"),
          title: `${t("الإجازات")} — Metal Fuze`,
          columns: LEAVE_COLS.map((h) => ({ header: t(h), width: h === NOTE ? 34 : 18 })),
          rows: filtered.map((r) => LEAVE_COLS.map((c) => (r.data[c] ?? "") as string | number)),
        }],
      });
      toast.success(t("تم تصدير تقرير Excel"));
    } catch { toast.error(t("تعذر التصدير")); }
  }

  const stats = [
    { label: "سجلات الإجازات", v: rows.length, icon: CalendarOff },
    { label: "في إجازة الآن", v: onNow, icon: CalendarOff },
    { label: "إجازات قادمة", v: upcoming, icon: CalendarOff },
    { label: "منتهية", v: ended, icon: CalendarOff },
    { label: "إجمالي أيام الإجازات", v: totalDays, icon: CalendarOff },
    { label: "أيام هذا الشهر", v: monthDays, icon: CalendarOff },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3 text-center sm:text-start">
        <div>
          <h1 className="font-display text-3xl font-extrabold sm:text-4xl">{t("الإجازات")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("كل إجازات الموظفين في مكان واحد — تتحدث تلقائيًا")} · {today}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportExcel}><FileSpreadsheet /> {t("تصدير Excel")}</Button>
          {canEdit && (
            <Button onClick={() => { const r: Rec = { id: "", sheet: "leaves", data: {}, sort: 0 }; setSel(r); startEdit(r); }}>
              <Plus /> {t("إضافة إجازة")}
            </Button>
          )}
        </div>
      </header>

      {!recs && <p className="text-center text-muted-foreground">{t("جارٍ التحميل…")}</p>}

      {recs && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl border border-border bg-card p-4 text-center">
                <div className="text-xs text-muted-foreground">{t(s.label)}</div>
                <div className="mt-1 font-display text-2xl font-bold">{s.v}</div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-48 flex-1">
              <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("بحث…")} className="pr-9" />
            </div>
            {(["all", "active", "upcoming", "ended"] as const).map((k) => (
              <Button key={k} size="sm" variant={status === k ? "secondary" : "outline"} onClick={() => setStatus(k)}>
                {k === "all" ? t("الكل") : t(ST[k])}
              </Button>
            ))}
            <select value={type} onChange={(e) => setType(e.target.value)}
              className="h-9 rounded-md border border-border bg-background px-3 text-sm">
              <option value="all">{t("كل الأنواع")}</option>
              {types.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>

          <section className="rounded-xl border border-border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-right text-xs text-muted-foreground">
                    {[NAME, DEPT, TYPE, FROM, TO, N, STATE, NOTE].map((c) => <th key={c} className="p-3 font-medium">{t(c)}</th>)}
                    {canEdit && <th className="p-3 font-medium">{t("تعديل")}</th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} onClick={() => open(r)} className="cursor-pointer border-b border-border/60 hover:bg-muted/40">
                      <td className="p-3 font-medium">{show(r.data[NAME])}</td>
                      <td className="p-3">{show(r.data[DEPT])}</td>
                      <td className="p-3">{show(r.data[TYPE])}</td>
                      <td className="p-3 whitespace-nowrap">{show(r.start ?? r.data[FROM])}</td>
                      <td className="p-3 whitespace-nowrap">{show(r.end ?? r.data[TO])}</td>
                      <td className="p-3">{show(r.days || r.data[N])}</td>
                      <td className="p-3">
                        {r.status
                          ? <Badge variant="outline" className={ST_TONE[r.status]}>{t(ST[r.status])}</Badge>
                          : <span className="text-muted-foreground">{show(r.data[STATE])}</span>}
                      </td>
                      <td className="max-w-64 p-3 text-xs text-muted-foreground">{show(r.data[NOTE])}</td>
                      {canEdit && (
                        <td className="p-3">
                          <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setSel(r); startEdit(r); }}>
                            <Pencil /> {t("تعديل")}
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {!filtered.length && (
                    <tr><td colSpan={8 + (canEdit ? 1 : 0)} className="p-8 text-center text-muted-foreground">{t("لا توجد نتائج")}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-xl border border-border bg-card p-4">
              <h2 className="mb-3 flex items-center gap-2 font-bold"><CalendarOff className="size-4" /> {t("أيام الإجازات حسب الشهر")} · {year}</h2>
              <div className="space-y-2">
                {byMonth.map((b) => (
                  <div key={b.m} className="flex items-center gap-3">
                    <span className="w-16 shrink-0 text-xs text-muted-foreground">
                      {new Date(`${b.m}-01T00:00:00`).toLocaleDateString(locale(), { month: "short" })}
                    </span>
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted/40">
                      <div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.round((b.days / maxMonth) * 100)}%` }} />
                    </div>
                    <span className="w-10 shrink-0 text-end text-xs">{b.days || "—"}</span>
                  </div>
                ))}
              </div>
            </section>
            <section className="rounded-xl border border-border bg-card p-4">
              <h2 className="mb-3 flex items-center gap-2 font-bold"><CalendarOff className="size-4" /> {t("أكثر الموظفين إجازات")}</h2>
              {!byEmp.length && <p className="text-sm text-muted-foreground">{t("لا توجد إجازات بعد")}</p>}
              <div className="space-y-2">
                {byEmp.map(([name, days]) => (
                  <div key={name} className="flex items-center gap-3">
                    <span className="w-40 shrink-0 truncate text-xs">{name}</span>
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted/40">
                      <div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.round((days / maxEmp) * 100)}%` }} />
                    </div>
                    <span className="w-10 shrink-0 text-end text-xs">{days}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </>
      )}

      <Dialog open={!!sel} onOpenChange={(o) => { if (!o) { setSel(null); setDraft(null); } }}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          {sel && (
            <>
              <DialogHeader>
                <DialogTitle>{sel.id ? show(sel.data[NAME]) : t("إضافة إجازة")}</DialogTitle>
              </DialogHeader>
              {canEdit && (
                <div className="flex flex-wrap gap-2">
                  {draft ? (
                    <>
                      <Button onClick={save}><Save /> {t("حفظ")}</Button>
                      {sel.id && <Button variant="outline" onClick={() => setDraft(null)}><X /> {t("إلغاء")}</Button>}
                    </>
                  ) : (
                    <>
                      <Button variant="outline" onClick={() => startEdit(sel)}><Pencil /> {t("تعديل")}</Button>
                      <Button variant="outline" className="text-destructive hover:text-destructive" onClick={remove}><Trash2 /> {t("حذف")}</Button>
                    </>
                  )}
                </div>
              )}
              <div className="grid gap-2 sm:grid-cols-2">
                {LEAVE_COLS.map((c) => (
                  <div key={c} className={`rounded-lg border border-border p-2 ${c === NOTE ? "sm:col-span-2" : ""}`}>
                    <div className="text-xs text-muted-foreground">{t(c)}</div>
                    {draft ? (
                      <Input className="mt-1 h-8" value={draft[c] ?? ""} onChange={(e) => setDraft({ ...draft, [c]: e.target.value })} />
                    ) : (
                      <div className="font-medium">{show(sel.data[c])}</div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
