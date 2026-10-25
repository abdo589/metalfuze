import { describe, expect, it } from "vitest";
import { payoutTotals, type Employee } from "./payroll";
const e: Employee = { id: "x", name: "A", role: "", dept: "", project: "", base: 3000, allowances: 500, deductions: 0,
  joined: "2026-08-10", active: true, paidMonths: ["2026-08", "2026-09"] };
describe("payoutTotals", () => {
  const now = new Date("2026-10-21T12:00:00Z");
  it("sums paid months", () => expect(payoutTotals(e, now).paid).toBe(7000));
  it("counts unpaid months since joining as remaining", () => expect(payoutTotals(e, now).remaining).toBe(3500));
});
