export type BankTxn = { date: string; description: string; amount: number; type: "in" | "out" };

/** Lean returns signed amounts or CREDIT/DEBIT indicators; normalise to in/out with positive amounts. */
export function normalizeTxn(raw: Record<string, unknown>): BankTxn {
  const amt = Number((raw["amount"] as { amount?: number } | number | undefined) && typeof raw["amount"] === "object"
    ? (raw["amount"] as { amount?: number }).amount
    : raw["amount"]) || 0;
  const ind = String(raw["credit_debit_indicator"] ?? raw["type"] ?? "").toUpperCase();
  const isIn = ind ? ind.startsWith("CREDIT") : amt >= 0;
  return {
    date: String(raw["timestamp"] ?? raw["booking_date_time"] ?? raw["date"] ?? ""),
    description: String(raw["description"] ?? raw["transaction_information"] ?? ""),
    amount: Math.abs(amt),
    type: isIn ? "in" : "out",
  };
}

export function txnTotals(txns: BankTxn[]) {
  let inflow = 0, outflow = 0;
  for (const x of txns) x.type === "in" ? (inflow += x.amount) : (outflow += x.amount);
  return { inflow, outflow, net: inflow - outflow };
}
