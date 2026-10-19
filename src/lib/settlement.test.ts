import { describe, expect, it } from "vitest";
import { endOfService, leavePay } from "./settlement";

describe("end of service", () => {
  it("pays half a month per year for the first 5 years", () => {
    expect(endOfService(10000, "2020-01-01", "2023-01-01", "انتهاء العقد بانتهاء مدته")).toBeCloseTo(15000, -2);
  });
  it("pays nothing on resignation under 2 years", () => {
    expect(endOfService(10000, "2025-01-01", "2026-06-01", "الاستقالة")).toBe(0);
  });
  it("pays nothing under article 80", () => {
    expect(endOfService(10000, "2010-01-01", "2026-01-01", "إنهاء العقد وفق المادة 80")).toBe(0);
  });
  it("leave pay uses wage / 30", () => {
    expect(leavePay(9000, 10)).toBe(3000);
  });
});
