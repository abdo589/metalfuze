import { describe, it, expect } from "vitest";
import { ipBlocked } from "./link-file.functions";
describe("ipBlocked", () => {
  it("allows public IPv6 like Google Drive", () => expect(ipBlocked("2607:f8b0:4004:c07::66")).toBe(false));
  it("allows public IPv4", () => expect(ipBlocked("142.250.80.46")).toBe(false));
  it("blocks private/loopback", () => { for (const ip of ["10.0.0.1","192.168.1.5","127.0.0.1","::1","fd00::1","fe80::1","::ffff:10.0.0.1"]) expect(ipBlocked(ip)).toBe(true); });
});
