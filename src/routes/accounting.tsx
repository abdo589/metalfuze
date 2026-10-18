import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Save, Trash2, FileDown, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { t, useLanguage } from "@/lib/i18n";

export const Route = createFileRoute("/accounting")({
  head: () => ({
    meta: [
      { title: "المحاسبة الخاصة — Metal Fuze" },
      { name: "description", content: "مساحة محاسبة خاصة لكشوف رواتب Metal Fuze والدفعات." },
      { property: "og:title", content: "المحاسبة الخاصة — Metal Fuze" },
      { property: "og:description", content: "كشوف الرواتب الشهرية والدفعات في مساحة خاصة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Accounting,
});

type Sheet = { id: string; name: string; sort: number; rows: string[][] };

function Accounting() {
  useLanguage();
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [active, setActive] = useState<string>("");
  const [draft, setDraft] = useState<string[][] | null>(null);

  const load = async () => {
    const { data, error } = await supabase.from("acct_sheets").select("id,name,sort,rows").order("sort");
    if (error) { toast.error(error.message); return; }
    const list = (data ?? []) as unknown as Sheet[];
    setSheets(list);
    setActive((a) => a || list[0]?.id || "");
  };
  useEffect(() => { load(); }, []);

  const sheet = sheets.find((s) => s.id === active);
  const rows = draft ?? sheet?.rows ?? [];
  const width = Math.max(1, ...rows.map((r) => r.length));

  const setCell = (i: number, j: number, v: string) =>
    setDraft((d) => (d ?? rows).map((r, ri) => (ri === i ? Array.from({ length: width }, (_, k) => (k === j ? v : r[k] ?? "")) : r)));

  async function save() {
    if (!sheet || !draft) return;
    const { error } = await supabase.from("acct_sheets").update({ rows: draft, updated_at: new Date().toISOString() }).eq("id", sheet.id);
    if (error) { toast.error(error.message); return; }
    toast.success(t("تم الحفظ")); setDraft(null); load();
  }

  async function addSheet() {
    const name = window.prompt(t("اسم الورقة"));
    if (!name?.trim()) return;
    const { data, error } = await supabase.from("acct_sheets").insert({ name: name.trim(), sort: sheets.length, rows: [["", "", "", ""]] }).select("id").single();
    if (error) { toast.error(error.message); return; }
    setActive(data.id); setDraft(null); load();
  }

  async function removeSheet() {
    if (!sheet || !window.confirm(`${t("حذف")} ${sheet.name}?`)) return;
    await supabase.from("acct_sheets").delete().eq("id", sheet.id);
    setActive(""); setDraft(null); load();
  }

  async function exportAll() {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    sheets.forEach((s) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s.rows), s.name.slice(0, 31)));
    XLSX.writeFile(wb, "Metal_Fuze_Accounting.xlsx");
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-8 sm:px-6">
      <header className="text-center">
        <h1 className="font-display text-3xl font-extrabold">{t("المحاسبة")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("مساحة خاصة — لا تظهر لأي حساب آخر")}</p>
      </header>

      <div className="flex flex-wrap gap-2">
        {sheets.map((s) => (
          <Button key={s.id} size="sm" variant={s.id === active ? "default" : "outline"}
            onClick={() => { if (draft && !window.confirm(t("تجاهل التعديلات غير المحفوظة؟"))) return; setDraft(null); setActive(s.id); }}>
            {s.name}
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={addSheet}><Plus /> {t("ورقة جديدة")}</Button>
      </div>

      {sheet && (
        <section className="rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
            <b className="flex-1">{sheet.name}</b>
            {draft ? (
              <>
                <Button size="sm" variant="outline" onClick={() => setDraft([...rows, Array(width).fill("")])}><Plus /> {t("صف")}</Button>
                <Button size="sm" onClick={save}><Save /> {t("حفظ")}</Button>
                <Button size="sm" variant="ghost" onClick={() => setDraft(null)}><X /> {t("إلغاء")}</Button>
              </>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setDraft(rows.map((r) => [...r]))}><Pencil /> {t("تعديل")}</Button>
            )}
            <Button size="sm" variant="outline" onClick={exportAll}><FileDown /> Excel</Button>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={removeSheet} aria-label={t("حذف")}><Trash2 /></Button>
          </div>
          <div className="overflow-x-auto" dir="ltr">
            <table className="w-full text-sm">
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-border/60 last:border-0 hover:bg-muted/40">
                    {Array.from({ length: width }, (_, j) => (
                      <td key={j} className="whitespace-nowrap border-e border-border/40 px-2 py-1">
                        {draft
                          ? <Input value={r[j] ?? ""} onChange={(e) => setCell(i, j, e.target.value)} className="h-7 min-w-24 px-1 text-xs" />
                          : r[j]}
                      </td>
                    ))}
                    {draft && (
                      <td className="px-1"><Button size="icon" variant="ghost" aria-label={t("حذف")} onClick={() => setDraft(rows.filter((_, k) => k !== i))}><Trash2 className="size-4 text-destructive" /></Button></td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
