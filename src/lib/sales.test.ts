import { describe, expect, it } from "vitest";
import { commissionDue } from "./sales";

describe("sales commission", () => {
  it("is 2% of the final contract value", () => {
    expect(commissionDue({ contract_value: 100000, commission_rate: 2 })).toBe(2000);
  });
  it("splits by share when another salesperson took part (50/50)", () => {
    expect(commissionDue({ contract_value: 100000, commission_rate: 2, shared: true, my_share: 50 })).toBe(1000);
  });
});
