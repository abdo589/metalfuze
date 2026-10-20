import { useEffect, useState } from "react";
import { Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { QUARTERS, REVIEW_STATUSES, grade } from "@/lib/performance";

type Review = { id: string; year: number; quarter: number; review_date: string | null; reviewer_name: string; total: number; status: string; manager_notes: string; development_plan: string };

/** Performance review history for one employee, matched by employee number or name. */
export function EmployeeReviews({ empNo, name }: { empNo: string; name: string }) {
  const [rows, setRows] = useState<Review[] | null>(null);
  useEffect(() => {
    (async () => {
      const { data: emps } = await supabase.from("employees").select("id,name");
      const ids = (emps ?? []).filter((e) => e.id === empNo || (name && e.name.trim() === name.trim())).map((e) => e.id);
      if (!ids.length) { setRows([]); return; }
      const { data } = await supabase.from("performance_reviews").select("*").in("employee_id", ids)
        .order("year", { ascending: false }).order("quarter", { ascending: false });
      setRows((data ?? []) as unknown as Review[]);
    })();
  }, [empNo, name]);

  const st = (k: string) => REVIEW_STATUSES.find((s) => s.key === k)?.ar ?? k;
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <h3 className="flex items-center gap-2 font-display text-lg font-bold"><Award className="size-5 text-primary" />تقييمات الأداء</h3>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border bg-muted/30 text-right text-xs text-muted-foreground">
            {["الربع", "السنة", "تاريخ التقييم", "المدير المقيّم", "الدرجة", "التقدير", "الحالة", "ملاحظات المدير", "خطة التطوير"].map((c) => <th key={c} className="p-2 font-medium">{c}</th>)}
          </tr></thead>
          <tbody>
            {rows?.map((r) => (
              <tr key={r.id} className="border-b border-border/60 last:border-0">
                <td className="p-2">{QUARTERS[r.quarter - 1]?.ar}</td>
                <td className="p-2">{r.year}</td>
                <td className="p-2">{r.review_date ?? "—"}</td>
                <td className="p-2">{r.reviewer_name || "—"}</td>
                <td className="p-2 font-bold text-primary">{Number(r.total)} / 100</td>
                <td className="p-2">{grade(Number(r.total))}</td>
                <td className="p-2"><span className="rounded-full bg-primary/15 px-3 py-0.5 text-xs font-semibold text-primary">{st(r.status)}</span></td>
                <td className="p-2">{r.manager_notes || "—"}</td>
                <td className="p-2">{r.development_plan || "—"}</td>
              </tr>
            ))}
            {rows && !rows.length && <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">لا توجد تقييمات</td></tr>}
            {!rows && <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">جارٍ التحميل…</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
