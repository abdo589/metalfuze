import { describe, expect, it } from "vitest";
import { canActOnSalesStep, hasCeoAccess } from "./ceo-access";

describe("Haitham shares the CEO account's rights", () => {
  it("gives CEO rights to the CEO and Haitham only", () => {
    expect(hasCeoAccess("ceo@metalfuze.local")).toBe(true);
    expect(hasCeoAccess("haitham@metalfuze.local")).toBe(true);
    expect(hasCeoAccess("eilaf@metalfuze.local")).toBe(false);
    expect(hasCeoAccess("hisham@metalfuze.local")).toBe(false);
  });
  it("lets Haitham approve the CEO sales step, but not Eilaf's steps", () => {
    expect(canActOnSalesStep("ceo_approval", "ceo@metalfuze.local", "haitham@metalfuze.local")).toBe(true);
    expect(canActOnSalesStep("ceo_approval", "ceo@metalfuze.local", "ceo@metalfuze.local")).toBe(true);
    expect(canActOnSalesStep("ceo_approval", "ceo@metalfuze.local", "eilaf@metalfuze.local")).toBe(false);
    expect(canActOnSalesStep("eilaf_review", "eilaf@metalfuze.local", "haitham@metalfuze.local")).toBe(false);
  });
});
