import { describe, expect, it } from "vitest";
import { warrantyInfo } from "./projects";

const base = { hasWarranty: "نعم", warrantyYears: 5, freeRepairYears: 1 };
describe("warranty", () => {
  it("no delivery date means not started", () => {
    expect(warrantyInfo({ ...base, deliveryDate: null })?.status).toBe("لم يبدأ");
  });
  it("computes free repair and warranty end from delivery", () => {
    const w = warrantyInfo({ ...base, deliveryDate: "2027-01-01" }, "2027-06-01")!;
    expect(w.freeEnd).toBe("2028-01-01");
    expect(w.end).toBe("2032-01-01");
    expect(w.status).toBe("ساري");
  });
  it("alerts one month before free repair ends", () => {
    expect(warrantyInfo({ ...base, deliveryDate: "2027-01-01" }, "2027-11-30")!.alerts).toEqual([]);
    expect(warrantyInfo({ ...base, deliveryDate: "2027-01-01" }, "2027-12-01")!.alerts).toEqual(["free"]);
    expect(warrantyInfo({ ...base, deliveryDate: "2027-01-01" }, "2031-12-01")!.alerts).toEqual(["end"]);
  });
  it("expired after the end date", () => {
    expect(warrantyInfo({ ...base, deliveryDate: "2027-01-01" }, "2032-01-01")!.status).toBe("منتهي");
  });
  it("no warranty returns null", () => {
    expect(warrantyInfo({ hasWarranty: "لا" })).toBeNull();
  });
});
