import { describe, expect, it } from "vitest";
import { approvedLeaveDates, countLeaveDays, entitlementFor, overlaps, returnDate, serviceYears, unpaidDaysInMonth, unpaidDeduction } from "./leave-engine";

const WE = [5, 6]; // Friday, Saturday
const tiers = [{ years: 0, days: 21 }, { years: 5, days: 30 }];

describe("leave rules", () => {
  it("counts working days without Friday/Saturday", () => {
    // 2026-10-18 (Sun) .. 2026-10-24 (Sat) = 5 working days
    expect(countLeaveDays("2026-10-18", "2026-10-24", WE)).toBe(5);
  });
  it("counts every day for calendar-day types", () => {
    expect(countLeaveDays("2026-10-18", "2026-10-24", WE, true)).toBe(7);
  });
  it("returns on the next working day", () => {
    expect(returnDate("2026-10-22", WE)).toBe("2026-10-25"); // Thu -> Sun
  });
  it("gives 21 days before 5 years and 30 days from 5 years", () => {
    expect(entitlementFor(serviceYears("2022-01-01", "2026-12-31"), tiers)).toBe(21);
    expect(entitlementFor(serviceYears("2021-10-18", "2026-10-18"), tiers)).toBe(30);
  });
  it("detects overlap only with active requests", () => {
    const reqs = [
      { id: "a", employee_id: "1", start_date: "2026-10-20", end_date: "2026-10-22", status: "approved" as const },
      { id: "b", employee_id: "1", start_date: "2026-10-25", end_date: "2026-10-26", status: "rejected" as const },
    ];
    expect(overlaps(reqs, "1", "2026-10-22", "2026-10-23")).toHaveLength(1);
    expect(overlaps(reqs, "1", "2026-10-25", "2026-10-26")).toHaveLength(0);
  });
  it("only approved leave marks attendance days", () => {
    const m = approvedLeaveDates([
      { employee_id: "1", start_date: "2026-10-20", end_date: "2026-10-21", status: "approved" },
      { employee_id: "1", start_date: "2026-10-25", end_date: "2026-10-25", status: "pending_hr" },
    ]);
    expect([...(m.get("1") ?? [])]).toEqual(["2026-10-20", "2026-10-21"]);
  });
  it("deducts unpaid leave pro-rata at gross / 30", () => {
    const reqs = [{ employee_id: "1", start_date: "2026-10-30", end_date: "2026-11-02", status: "approved" as const, type_id: "unpaid" }];
    const days = unpaidDaysInMonth(reqs, [{ id: "unpaid", paid: false }], "1", "2026-10");
    expect(days).toBe(2);
    expect(unpaidDeduction(9000, days)).toBe(600);
  });
});
