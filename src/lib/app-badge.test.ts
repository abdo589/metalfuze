import { describe, expect, it } from "vitest";
import { badgeLabel, hasSalesStep, salesWaitingCount } from "./app-badge";

describe("laptop icon counter", () => {
  it("hides at zero and caps at 99+", () => {
    expect(badgeLabel(0)).toBeNull();
    expect(badgeLabel(3)).toBe("3");
    expect(badgeLabel(150)).toBe("99+");
  });
  it("counts sales requests waiting on Eilaf's steps only", () => {
    const steps = ["eilaf_review", "eilaf_quotation", "haitham_pricing", "done", "sales_entry"];
    expect(salesWaitingCount(steps, "eilaf@metalfuze.local")).toBe(2);
  });
  it("Haitham also counts CEO approvals", () => {
    expect(salesWaitingCount(["haitham_approval", "ceo_approval", "eilaf_review"], "haitham@metalfuze.local")).toBe(2);
  });
  it("accounts without a step never query sales", () => {
    expect(hasSalesStep("aisha@metalfuze.local")).toBe(false);
    expect(hasSalesStep("ceo@metalfuze.local")).toBe(true);
  });
});
