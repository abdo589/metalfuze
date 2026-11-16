import { describe, expect, it } from "vitest";
import { parseTypedAmount } from "./typed-amount";

describe("parseTypedAmount (settlement other dues typed by hand)", () => {
  it("reads a plain typed number", () => expect(parseTypedAmount("1500")).toBe(1500));
  it("reads Arabic digits", () => expect(parseTypedAmount("٢٥٠٠")).toBe(2500));
  it("ignores thousands commas", () => expect(parseTypedAmount("12,345.5")).toBe(12345.5));
  it("treats empty or invalid text as zero", () => { expect(parseTypedAmount("")).toBe(0); expect(parseTypedAmount("abc")).toBe(0); });
});
