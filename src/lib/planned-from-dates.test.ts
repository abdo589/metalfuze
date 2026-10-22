import { describe, it, expect } from "vitest";
import { plannedFromDates } from "./projects";
describe("planned % from dates", () => {
  it("is elapsed share of duration", () => expect(plannedFromDates({ start: "2026-01-01", end: "2026-01-11" }, "2026-01-06")).toBeCloseTo(0.5));
  it("caps at 100% after end", () => expect(plannedFromDates({ start: "2026-01-01", end: "2026-01-11" }, "2026-03-01")).toBe(1));
  it("is 0 before start", () => expect(plannedFromDates({ start: "2026-01-01", end: "2026-01-11" }, "2025-12-01")).toBe(0));
});
