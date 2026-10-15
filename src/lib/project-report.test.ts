import { describe, expect, it } from "vitest";
import { buildProjectReport, periodRange, shiftPeriod } from "./project-report";
import type { Project } from "./projects";

const project = (fields: Partial<Project>): Project => ({ id: "p", name: "Test", code: "1", sector: "", dept: "", manager: "", owner: "", start: null, end: null, status: "", progress: 0, planned: 0, contract: 0, paid: 0, hasContract: "", issues: "", notes: "", ...fields });
describe("Project period reports", () => {
  it("uses Monday weeks across year boundaries", () => {
    expect(periodRange("weekly", new Date(2026, 0, 1))).toMatchObject({ from: "2025-12-29", to: "2026-01-04" });
  });
  it("handles leap months and year navigation", () => {
    expect(periodRange("monthly", new Date(2024, 1, 10)).to).toBe("2024-02-29");
    expect(shiftPeriod("yearly", new Date(2026, 9, 15), -1).getFullYear()).toBe(2025);
  });
  it("includes overlapping and undated projects, excludes others, preserves cumulative money", () => {
    const report = buildProjectReport([project({ id: "a", start: "2026-01-01", end: "2026-10-01", contract: 100, paid: 30 }), project({ id: "b", contract: 50, paid: 5 }), project({ id: "c", end: "2026-09-30", contract: 500 }), project({ id: "d", start: "2026-11-01" })], "monthly", new Date(2026, 9, 15), "2026-10-15");
    expect(report.rows.map((p) => p.id)).toEqual(["a", "b"]);
    expect(report.remaining).toBe(115);
    expect(report.undated).toBe(1);
  });
  it("returns safe empty totals", () => {
    expect(buildProjectReport([], "yearly", new Date(2026, 0, 1), "2026-01-01")).toMatchObject({ contract: 0, paid: 0, average: 0 });
  });
});