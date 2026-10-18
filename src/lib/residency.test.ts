import { describe, expect, it } from "vitest";
import { daysLeft, docStatus } from "./residency";

describe("residency alerts", () => {
  it("counts days left", () => expect(daysLeft("2026-10-25", "2026-10-18")).toBe(7));
  it("expired when past", () => expect(docStatus(-1)).toBe("expired"));
  it("alerts within 60 days", () => { expect(docStatus(60)).toBe("soon"); expect(docStatus(61)).toBe("valid"); });
});
