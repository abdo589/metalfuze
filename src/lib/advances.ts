import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AdjRow = { sheet: string; data: Record<string, unknown> };
export type Adj = { advances: number; commissions: number };

const n = (v: unknown) => Number(v) || 0;
/** Month (YYYY-MM) an advance/commission hits payroll: explicit "شهر الخصم"/"شهر الصرف", else its date's month. */
export const adjMonth = (r: AdjRow) => {
  const d = r.data;
  const m = String((r.sheet === "advances" ? d["شهر الخصم"] : d["شهر الصرف"]) ?? "") ||
    String((r.sheet === "advances" ? d["تاريخ السلفة"] : d["تاريخ الاستحقاق"]) ?? "");
  return m.slice(0, 7);
};

/** Per-employee payroll adjustments for a month: active advance balances are deducted, non-draft commissions added. */
export function computeAdjustments(rows: AdjRow[], month: string): Map<string, Adj> {
  const out = new Map<string, Adj>();
  for (const r of rows) {
    if (adjMonth(r) !== month) continue;
    const id = String(r.data["رقم الموظف"] ?? "");
    const a = out.get(id) ?? { advances: 0, commissions: 0 };
    if (r.sheet === "advances" && r.data["الحالة"] !== "مغلقة") a.advances += Math.max(0, n(r.data["المبلغ"]) - n(r.data["المسدد"]));
    if (r.sheet === "commissions" && r.data["الحالة"] !== "مسودة") a.commissions += n(r.data["المبلغ"]);
    out.set(id, a);
  }
  return out;
}

export function useAdjustments(month: string) {
  const [rows, setRows] = useState<AdjRow[]>([]);
  useEffect(() => {
    const load = () => supabase.from("hr_records").select("sheet,data").in("sheet", ["advances", "commissions"])
      .then(({ data }) => setRows((data ?? []) as AdjRow[]));
    load();
    const ch = supabase.channel(`adj-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "hr_records" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);
  return computeAdjustments(rows, month);
}
