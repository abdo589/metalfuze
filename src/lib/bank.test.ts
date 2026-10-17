import { describe, it, expect } from "vitest";
import { normalizeTxn, txnTotals } from "./bank";

describe("bank", () => {
  it("credit indicator is money in", () => {
    expect(normalizeTxn({ amount: 500, credit_debit_indicator: "CREDIT" }).type).toBe("in");
  });
  it("negative amount without indicator is money out, stored positive", () => {
    const x = normalizeTxn({ amount: -200 });
    expect(x).toMatchObject({ type: "out", amount: 200 });
  });
  it("totals in, out and net", () => {
    expect(txnTotals([
      { date: "", description: "", amount: 1000, type: "in" },
      { date: "", description: "", amount: 300, type: "out" },
    ])).toEqual({ inflow: 1000, outflow: 300, net: 700 });
  });
});
