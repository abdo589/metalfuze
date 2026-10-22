import { describe, expect, it } from "vitest";
import { BloomFilter, findDuplicate } from "./bloom";

describe("duplicate check", () => {
  it("flags a project code already used, ignoring case and spaces", () => {
    expect(findDuplicate(["MF-001", "MF-002"], " mf-001 ")).toBe(true);
  });
  it("does not flag a new value", () => {
    expect(findDuplicate(["MF-001", "MF-002"], "MF-003")).toBe(false);
  });
  it("never misses an added value", () => {
    const f = new BloomFilter();
    const vals = Array.from({ length: 500 }, (_, i) => `emp-${i}`);
    vals.forEach((v) => f.add(v));
    expect(vals.every((v) => f.mightContain(v))).toBe(true);
  });
});
