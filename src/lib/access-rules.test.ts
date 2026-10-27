import { describe, expect, it } from "vitest";
import { checkAccess, type AccessRules } from "./access-rules";

const base: AccessRules = { days: [], start_time: "", end_time: "", allowed_ips: [], devices: [] };
const pc = "Mozilla/5.0 (Windows NT 10.0) Chrome/120";
// 2026-10-27 is a Tuesday; 06:00 UTC = 09:00 Riyadh
const tue9 = new Date("2026-10-27T06:00:00Z");

describe("checkAccess", () => {
  it("no rules allows", () => expect(checkAccess(base, { now: tue9, ip: "1.2.3.4", ua: pc })).toBe(""));
  it("blocks disallowed day", () => expect(checkAccess({ ...base, days: [0] }, { now: tue9, ip: "", ua: pc })).not.toBe(""));
  it("blocks outside hours (Riyadh)", () => {
    expect(checkAccess({ ...base, start_time: "08:00", end_time: "17:00" }, { now: tue9, ip: "", ua: pc })).toBe("");
    expect(checkAccess({ ...base, start_time: "10:00", end_time: "17:00" }, { now: tue9, ip: "", ua: pc })).not.toBe("");
  });
  it("ip list with prefix", () => {
    expect(checkAccess({ ...base, allowed_ips: ["5.6.*"] }, { now: tue9, ip: "5.6.7.8", ua: pc })).toBe("");
    expect(checkAccess({ ...base, allowed_ips: ["5.6.7.9"] }, { now: tue9, ip: "5.6.7.8", ua: pc })).not.toBe("");
  });
  it("device type", () => expect(checkAccess({ ...base, devices: ["mobile"] }, { now: tue9, ip: "", ua: pc })).not.toBe(""));
});
