import { describe, expect, it } from "vitest";
import { remainingFor } from "./payroll";

describe("remaining to pay", () => {
  it("is what is still owed", () => { expect(remainingFor(8000, 6038)).toBe(1962); });
  it("is zero when paid more than the salary", () => { expect(remainingFor(7000, 11000)).toBe(0); });
  it("September sheet: overpaying Haitham and Eilaf does not reduce others' 11,152 remaining", () => {
    const rows: [number, number][] = [[6500, 5000], [7000, 11000], [8000, 6038], [5000, 6000], [2000, 0], [2000, 0], [2000, 0], [1500, 0], [15000, 14810]];
    expect(rows.reduce((a, [n, p]) => a + remainingFor(n, p), 0)).toBe(11152);
  });
});
