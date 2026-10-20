import { describe, expect, it } from "vitest";
import { CRITERIA, isLate, quarterOf, totalScore } from "./performance";

describe("performance reviews", () => {
  it("criteria add up to 100", () => expect(CRITERIA.reduce((s, c) => s + c.max, 0)).toBe(100));
  it("quarters: Jan-Mar=1, Apr-Jun=2, Jul-Sep=3, Oct-Dec=4", () => {
    expect(quarterOf(new Date(2026, 2, 31))).toBe(1);
    expect(quarterOf(new Date(2026, 3, 1))).toBe(2);
    expect(quarterOf(new Date(2026, 8, 30))).toBe(3);
    expect(quarterOf(new Date(2026, 9, 1))).toBe(4);
  });
  it("caps each score at its max", () => expect(totalScore({ quality: 40, policies: 10 })).toBe(35));
  it("late after quarter ends unless completed/approved", () => {
    expect(isLate(2026, 3, "in_progress", new Date(2026, 9, 5))).toBe(true);
    expect(isLate(2026, 3, "approved", new Date(2026, 9, 5))).toBe(false);
    expect(isLate(2026, 4, null, new Date(2026, 9, 5))).toBe(false);
  });
});
