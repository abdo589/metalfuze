import { describe, expect, it } from "vitest";
import { nextNumber, totals, type Txn } from "./transactions";

const tx = (type: Txn["type"], amount: number, number = ""): Txn => ({
  id: Math.random().toString(), number, type, date: "2026-10-01", manager: "En.Hisham",
  project: "", party: "", amount, method: "", notes: "",
});

describe("payments & collections", () => {
  it("balance is collected minus paid", () => {
    expect(totals([tx("collect", 1000), tx("pay", 300), tx("collect", 500)])).toEqual({ collected: 1500, paid: 300, balance: 1200 });
  });
  it("numbers invoices separately per type", () => {
    const list = [tx("collect", 1, "REC-0002"), tx("pay", 1, "PAY-0001")];
    expect(nextNumber(list, "collect")).toBe("REC-0003");
    expect(nextNumber(list, "pay")).toBe("PAY-0002");
  });
});
