import { describe, expect, it } from "vitest";
import { forMonth, paidFor, withPaid, type Employee } from "./payroll";
const e: Employee = { id: "x", name: "A", role: "", dept: "", project: "", base: 15000, allowances: 0, deductions: 0,
  joined: null, active: true, paidMonths: [] };
describe("monthly payout", () => {
  const s = withPaid(e, "2026-09", 8700);
  it("stores the month's transferred amount", () => expect(paidFor(s, "2026-09", 15000)).toBe(8700));
  it("does not carry the amount to the next month", () => expect(paidFor(s, "2026-10", 15000)).toBe(0));
  it("keeps the salary unchanged", () => expect(forMonth(s, "2026-10").base).toBe(15000));
  it("treats a month marked paid as fully paid", () => expect(paidFor({ ...e, paidMonths: ["2026-08"] }, "2026-08", 15000)).toBe(15000));
});
