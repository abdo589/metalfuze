import { describe, expect, it } from "vitest";
import { availableMonths, forMonth, payrollNet, type Employee } from "./payroll";

const e: Employee = {
  id: "x", name: "A", role: "", dept: "", project: "", base: 5000, allowances: 500, deductions: 0,
  joined: null, active: true, paidMonths: [],
  monthly: { "2026-10": { base: 6000, allowances: 700, deductions: 100 } },
};

describe("forMonth", () => {
  it("carries October salary into November without requiring a new record", () => {
    const november = forMonth(e, "2026-11");
    expect([november.base, november.allowances, november.deductions]).toEqual([6000, 700, 100]);
  });
  it("uses default salary before any monthly change", () => expect(forMonth(e, "2026-09").base).toBe(5000));
  it("uses the month's own salary", () => expect(forMonth(e, "2026-10").base).toBe(6000));
  it("carries the change forward to later months", () => expect(forMonth(e, "2026-12").allowances).toBe(700));
});

describe("payroll excludes separate commissions", () => {
  it("never adds a commission to salary", () => {
    expect(payrollNet(e, 0, { advances: 0, commissions: 15000 })).toBe(5500);
  });
  it("keeps Najla's 4763 advances and fines outside her 12000 salary", () => {
    expect(payrollNet({ ...e, base: 12000, allowances: 0 }, 0, { advances: 4763, commissions: 0 })).toBe(12000);
  });
  it("still applies unpaid leave independently of separate balances", () => {
    expect(payrollNet(e, 200, { advances: 1500, commissions: 15000 })).toBe(5300);
  });
});

describe("availableMonths", () => {
  const now = new Date("2026-10-21T12:00:00Z");
  it("falls back to the last 12 months with no data", () =>
    expect(availableMonths([e], now)).toEqual(["2025-11", "2025-12", ...Array.from({ length: 10 }, (_, i) => `2026-${String(i + 1).padStart(2, "0")}`)]));
  it("starts from the earliest joined month", () =>
    expect(availableMonths([{ ...e, joined: "2024-03-15" }], now)[0]).toBe("2024-03"));
  it("extends back to an earlier monthly salary record", () =>
    expect(availableMonths([{ ...e, monthly: { "2025-08": { base: 4000, allowances: 0, deductions: 0 } } }], now)[0]).toBe("2025-08"));
  it("covers at least the last 12 months even when data is recent", () =>
    expect(availableMonths([{ ...e, paidMonths: ["2026-01"] }], now)[0]).toBe("2025-11"));
  it("always ends at the current month", () => {
    const list = availableMonths([e], now);
    expect(list[list.length - 1]).toBe("2026-10");
  });
});
