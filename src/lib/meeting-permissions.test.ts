import { describe, expect, it } from "vitest";
import { EXECUTIVE_PATHS, SALES_PATHS } from "./permissions";
describe("separate meeting page", () => {
  it("allows sales and Hisham to open meetings without granting Hisham pricing access", () => {
    expect(SALES_PATHS.includes("/meetings")).toBe(true);
    expect(SALES_PATHS.includes("/sales")).toBe(true);
    expect(EXECUTIVE_PATHS.includes("/meetings")).toBe(true);
    expect(EXECUTIVE_PATHS.includes("/sales")).toBe(false);
  });
});