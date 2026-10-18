import { describe, expect, it } from "vitest";
import { IDLE_MS, WARN_MS, idleExpired, warnSoon } from "./idle-signout";

const NOW = Date.UTC(2026, 9, 18, 12, 0, 0);
const MIN = 60 * 1000;

describe("idle sign-out clock", () => {
  it("signs out after one hour without activity", () => {
    expect(IDLE_MS).toBe(60 * MIN);
    expect(idleExpired(NOW - (60 * MIN + 1000), NOW)).toBe(true); // 1h01m idle
    expect(idleExpired(NOW - (59 * MIN), NOW)).toBe(false); // 59m idle
  });

  it("warns only during the last five minutes", () => {
    expect(WARN_MS).toBe(5 * MIN);
    expect(warnSoon(NOW - (56 * MIN), NOW)).toBe(true); // 4m left
    expect(warnSoon(NOW - (50 * MIN), NOW)).toBe(false); // 10m left
    expect(warnSoon(NOW - (61 * MIN), NOW)).toBe(false); // already past the cut-off
  });
});
