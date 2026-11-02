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

export function advanceRepayments(r: AdjRow): Record<string, number> {
  const value = r.data["سداد شهري"];
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([month, amount]) => /^\d{4}-\d{2}$/.test(month) && typeof amount === "number" && Number.isFinite(amount) && amount >= 0));
}

export function advanceBalance(r: AdjRow, month: string): number {
  const start = adjMonth(r);
  if (!start || start > month || r.data["الحالة"] === "مغلقة") return 0;
  const prior = Object.entries(advanceRepayments(r)).filter(([key]) => key < month).reduce((sum, [, amount]) => sum + amount, 0);
  return Math.max(0, n(r.data["المبلغ"]) - n(r.data["المسدد"]) - prior);
}

export function advanceDeduction(r: AdjRow, month: string): number {
  const balance = advanceBalance(r, month);
  const payment = advanceRepayments(r)[month];
  return payment === undefined ? balance : Math.min(balance, payment);
}

/** Unpaid advance balances carry forward; commissions stay exact-month and separate from salary. */
export function computeAdjustments(rows: AdjRow[], month: string): Map<string, Adj> {
  const out = new Map<string, Adj>();
  for (const r of rows) {
    if (r.sheet !== "advances" && adjMonth(r) !== month) continue;
    const id = String(r.data["رقم الموظف"] ?? "");
    const a = out.get(id) ?? { advances: 0, commissions: 0 };
    if (r.sheet === "advances") a.advances += advanceDeduction(r, month);
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
