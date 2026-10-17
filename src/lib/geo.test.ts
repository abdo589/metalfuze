import { describe, expect, it } from "vitest";
import { checkSite, isRepeat } from "./geo";

const site = { lat: 24.7136, lng: 46.6753, radius_m: 150 };

describe("remote check-in site rule", () => {
  it("accepts a check-in about 100 m from the site", () => {
    expect(checkSite({ lat: 24.7145, lng: 46.6753 }, site).ok).toBe(true);
  });
  it("refuses a check-in about 820 m from the site", () => {
    const r = checkSite({ lat: 24.7210, lng: 46.6753 }, site);
    expect(r.ok).toBe(false);
    expect(r.distance).toBeGreaterThan(800);
  });
});

describe("1-minute repeat rule", () => {
  const now = Date.parse("2026-10-17T09:00:00Z");
  it("ignores a second tap after 30 seconds", () => {
    expect(isRepeat("2026-10-17T08:59:30Z", now)).toBe(true);
  });
  it("accepts a tap after 2 minutes", () => {
    expect(isRepeat("2026-10-17T08:58:00Z", now)).toBe(false);
  });
});
