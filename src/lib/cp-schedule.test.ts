import { describe, expect, it } from "vitest";
import { monthOf, periodReport, plannedProgress, scheduleProgress, weekOf } from "./cp";

describe("schedule & reports", () => {
  it("weights progress by duration", () => {
    expect(scheduleProgress([
      { start_date: "2026-01-01", end_date: "2026-01-10", progress: 100 },
      { start_date: "2026-01-11", end_date: "2026-01-20", progress: 0 },
    ])).toBe(50);
  });
  it("planned progress at a date", () => {
    expect(plannedProgress([{ start_date: "2026-01-01", end_date: "2026-01-10" }], "2026-01-05")).toBe(50);
  });
  it("weeks start Monday", () => {
    expect(weekOf("2026-10-29")).toEqual({ from: "2026-10-26", to: "2026-11-01" });
  });
  it("month range", () => {
    expect(monthOf("2026-02-10")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });
  it("sums manpower from daily reports in the period", () => {
    const r = periodReport({
      daily: [
        { report_date: "2026-10-26", manpower: { مدني: 10 }, issues: "" },
        { report_date: "2026-10-27", manpower: { مدني: 5, كهرباء: 2 }, issues: "x" },
        { report_date: "2026-11-05", manpower: { مدني: 99 }, issues: "" },
      ] as never, subs: [], invoices: [], acts: [],
    }, "2026-10-26", "2026-11-01");
    expect(r.manpower).toEqual({ مدني: 15, كهرباء: 2 });
    expect(r.issues.length).toBe(1);
  });
});
