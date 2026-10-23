import { describe, expect, it } from "vitest";
import { shouldForceOut } from "./force-logout";

describe("shouldForceOut", () => {
  it("session older than forced sign-out ends", () => expect(shouldForceOut("2026-10-23T10:00:00Z", "2026-10-23T11:00:00Z")).toBe(true));
  it("session newer than forced sign-out stays", () => expect(shouldForceOut("2026-10-23T12:00:00Z", "2026-10-23T11:00:00Z")).toBe(false));
  it("no forced sign-out keeps session", () => expect(shouldForceOut("2026-10-23T12:00:00Z", null)).toBe(false));
});
