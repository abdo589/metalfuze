import { describe, expect, it } from "vitest";
import { daysInMonth, leaveDays, leaveStatus, monthLast, toIso } from "./leave";

describe("leave dates", () => {
  it("reads the three date shapes used in the HR file", () => {
    expect(toIso("2026-03-10")).toBe("2026-03-10");
    expect(toIso("10/03/2026")).toBe("2026-03-10");
    expect(toIso(25569)).toBe("1970-01-01");
    expect(toIso("")).toBeNull();
  });

  it("marks a leave running, upcoming or over", () => {
    const a = "2026-03-10";
    const b = "2026-03-25";
    expect(leaveStatus(a, b, "2026-03-15")).toBe("active");
    expect(leaveStatus(a, b, "2026-02-01")).toBe("upcoming");
    expect(leaveStatus(a, b, "2026-04-01")).toBe("ended");
    expect(leaveStatus("", "", "2026-04-01")).toBeNull();
  });

  it("counts both end days and falls back to the sheet's count", () => {
    expect(leaveDays("2026-03-10", "2026-03-25", null)).toBe(16);
    expect(leaveDays("", "", 5)).toBe(5);
    expect(leaveDays("", "", "x")).toBe(0);
  });

  it("splits leave days across months", () => {
    expect(daysInMonth("2026-02-20", "2026-03-05", "2026-03")).toBe(5);
    expect(daysInMonth("2026-02-20", "2026-03-05", "2026-02")).toBe(9);
    expect(daysInMonth("2026-03-10", "2026-03-25", "2026-04")).toBe(0);
  });

  it("knows month ends, leap years included", () => {
    expect(monthLast("2026-02")).toBe("2026-02-28");
    expect(monthLast("2024-02")).toBe("2024-02-29");
    expect(monthLast("2026-04")).toBe("2026-04-30");
  });
});
