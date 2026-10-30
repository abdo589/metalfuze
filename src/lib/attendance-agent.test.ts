import { describe, it, expect } from "vitest";
import { filterAgentPunches, tokenMatches } from "./attendance-agent";

const now = Date.parse("2026-10-30T12:00:00Z");

describe("attendance agent", () => {
  it("rejects a wrong or empty token", () => {
    expect(tokenMatches("abc", "abd")).toBe(false);
    expect(tokenMatches("", "")).toBe(false);
    expect(tokenMatches("secret-1", "secret-1")).toBe(true);
  });
  it("drops future punches and punches older than 45 days", () => {
    const r = filterAgentPunches([
      { device_user_id: "12", punched_at: "2026-10-30T09:00:00+03:00" },
      { device_user_id: "12", punched_at: "2026-10-31T12:00:00Z" },
      { device_user_id: "12", punched_at: "2026-09-01T09:00:00Z" },
    ], now);
    expect(r).toHaveLength(1);
  });
  it("drops non-numeric employee numbers", () => {
    expect(filterAgentPunches([{ device_user_id: "x1", punched_at: "2026-10-30T09:00:00Z" }], now)).toHaveLength(0);
  });
});
