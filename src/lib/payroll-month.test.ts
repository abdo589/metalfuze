import { describe, expect, it } from "vitest";
import { availableMonths, forMonth, type Employee } from "./payroll";

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

describe("availableMonths", () => {
  const now = new Date("2026-10-21T12:00:00Z");
  it("falls back to the last 12 months with no data", () =>
    expect(availableMonths([e], now)).toEqual(["2025-11", "2025-12", ...Array.from({ length: 10 }, (_, i) => `2026-${String(i + 1).padStart(2, "0")}`)]));
  it("starts from the earliest joined month", () =>
    expect(availableMonths([{ ...e, joined: "2024-03-15" }], now)[0]).toBe("2024-03"));
  it("starts from the earliest monthly salary record", () =>
    expect(availableMonths([{ ...e, monthly: { "2025-08": { base: 4000, allowances: 0, deductions: 0 } } }], now)[0]).toBe("2025-08"));
  it("starts from the earliest paid month", () =>
    expect(availableMonths([{ ...e, paidMonths: ["2026-01"] }], now)[0]).toBe("2026-01"));
  it("always ends at the current month", () => {
    const list = availableMonths([e], now);
    expect(list[list.length - 1]).toBe("2026-10");
  });
});
