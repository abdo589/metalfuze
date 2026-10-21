import { describe, expect, it } from "vitest";
import { forMonth, type Employee } from "./payroll";

const e: Employee = {
  id: "x", name: "A", role: "", dept: "", project: "", base: 5000, allowances: 500, deductions: 0,
  joined: null, active: true, paidMonths: [],
  monthly: { "2026-10": { base: 6000, allowances: 700, deductions: 100 } },
};

describe("forMonth", () => {
  it("uses default salary before any monthly change", () => expect(forMonth(e, "2026-09").base).toBe(5000));
  it("uses the month's own salary", () => expect(forMonth(e, "2026-10").base).toBe(6000));
  it("carries the change forward to later months", () => expect(forMonth(e, "2026-12").allowances).toBe(700));
});
