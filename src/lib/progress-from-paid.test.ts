import { describe, it, expect } from "vitest";
import { progressFromPaid, withAutoStatus, type Project } from "./projects";

const p = (fields: Partial<Project>): Project => ({ id: "p", name: "T", code: "1", sector: "", dept: "", manager: "", owner: "", start: null, end: null, status: "", progress: 0.9, planned: 0, contract: 0, paid: 0, hasContract: "", issues: "", notes: "", ...fields });

describe("project progress from paid payments", () => {
  it("is paid divided by the total contract value", () => expect(progressFromPaid({ contract: 1_000_000, paid: 250_000 })).toBe(0.25));
  it("never goes above 100% when overpaid", () => expect(progressFromPaid({ contract: 100, paid: 150 })).toBe(1));
  it("has no value without a contract value", () => expect(progressFromPaid({ contract: 0, paid: 500 })).toBeNull());
  it("replaces the typed progress on the dashboard", () => expect(withAutoStatus(p({ contract: 400_000, paid: 100_000 })).progress).toBe(0.25));
  it("keeps the typed progress when there is no contract value", () => expect(withAutoStatus(p({ contract: 0 })).progress).toBe(0.9));
});
