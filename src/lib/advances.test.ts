import { describe, expect, it } from "vitest";
import { computeAdjustments } from "./advances";

const adv = (d: Record<string, unknown>) => ({ sheet: "advances", data: { "رقم الموظف": "18", "الحالة": "نشطة", ...d } });

describe("payroll advances", () => {
  it("deducts the remaining advance balance in its month", () => {
    const m = computeAdjustments([adv({ "المبلغ": 2000, "المسدد": 500, "تاريخ السلفة": "2026-10-03" })], "2026-10");
    expect(m.get("18")?.advances).toBe(1500);
  });
  it("ignores closed advances and other months", () => {
    const m = computeAdjustments([adv({ "المبلغ": 500, "الحالة": "مغلقة", "شهر الخصم": "2026-10" }), adv({ "المبلغ": 900, "شهر الخصم": "2026-11" })], "2026-10");
    expect(m.get("18")?.advances ?? 0).toBe(0);
  });
  it("adds non-draft commissions", () => {
    const m = computeAdjustments([{ sheet: "commissions", data: { "رقم الموظف": "17", "المبلغ": 15000, "الحالة": "معتمدة", "شهر الصرف": "2026-10" } }], "2026-10");
    expect(m.get("17")?.commissions).toBe(15000);
  });
  it("carries Najla's 4763 October balance into November", () => {
    const rows = [2000, 375, 1000, 413, 375, 600].map((amount) => adv({ "المبلغ": amount, "المسدد": 0, "شهر الخصم": "2026-10" }));
    expect(computeAdjustments(rows, "2026-11").get("18")?.advances).toBe(4763);
    expect(computeAdjustments(rows, "2026-09").get("18")?.advances).toBe(0);
  });
  it("does not deduct October repayments again in November", () => {
    const rows = [adv({ "المبلغ": 4763, "شهر الخصم": "2026-10", "سداد شهري": { "2026-10": 4763 } })];
    expect(computeAdjustments(rows, "2026-10").get("18")?.advances).toBe(4763);
    expect(computeAdjustments(rows, "2026-11").get("18")?.advances).toBe(0);
  });
  it("carries only the unpaid part after a partial monthly repayment", () => {
    const rows = [adv({ "المبلغ": 4763, "شهر الخصم": "2026-10", "سداد شهري": { "2026-10": 1000 } })];
    expect(computeAdjustments(rows, "2026-10").get("18")?.advances).toBe(1000);
    expect(computeAdjustments(rows, "2026-11").get("18")?.advances).toBe(3763);
  });
});
