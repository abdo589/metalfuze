import { describe, expect, it } from "vitest";
import { sumPrices, toAmount } from "./sales-price";

describe("pricing value from quotation files", () => {
  it("adds the price of every file", () => {
    expect(sumPrices([{ status: "done", amount: 100000 }, { status: "done", amount: 25500.5 }])).toBe(125500.5);
  });
  it("skips files with no price or still reading", () => {
    expect(sumPrices([{ status: "done", amount: 40000 }, { status: "failed", amount: null }, { status: "reading", amount: null }])).toBe(40000);
  });
  it("returns null when no file had a price", () => {
    expect(sumPrices([{ status: "failed", amount: null }])).toBeNull();
  });
  it("reads Arabic digits and separators", () => {
    expect(toAmount("١٬٢٥٠٬٠٠٠ ريال")).toBe(1250000);
    expect(toAmount("1,250.75 SAR")).toBe(1250.75);
    expect(toAmount(0)).toBeNull();
  });
});
