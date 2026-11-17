import { describe, expect, it } from "vitest";
import { badgeLabel, hasSalesStep, salesWaitingCount } from "./app-badge";

describe("laptop icon counter", () => {
  it("hides at zero and caps at 99+", () => {
    expect(badgeLabel(0)).toBeNull();
    expect(badgeLabel(3)).toBe("3");
    expect(badgeLabel(150)).toBe("99+");
  });
  it("counts sales requests waiting on Eilaf's steps only", () => {
    const steps = ["eilaf_review", "eilaf_quotation", "haitham_pricing", "done", "sales_entry"];
    expect(salesWaitingCount(steps, "eilaf@metalfuze.local")).toBe(2);
  });
  it("Haitham also counts CEO approvals", () => {
    expect(salesWaitingCount(["haitham_approval", "ceo_approval", "eilaf_review"], "haitham@metalfuze.local")).toBe(2);
  });
  it("accounts without a step never query sales", () => {
    expect(hasSalesStep("aisha@metalfuze.local")).toBe(false);
    expect(hasSalesStep("ceo@metalfuze.local")).toBe(true);
  });
});

import { leavesWaitingCount, meetingsWaitingCount } from "./app-badge";

describe("waiting items per account", () => {
  it("leave approvers count both pending stages; others count nothing", () => {
    const st = ["pending_manager", "pending_hr", "approved", "draft", "rejected"];
    expect(leavesWaitingCount(st, true)).toBe(2);
    expect(leavesWaitingCount(st, false)).toBe(0);
  });
  it("counts upcoming unanswered meetings for Haitham only", () => {
    const now = Date.parse("2026-11-17T12:00:00Z");
    const ms = [
      { id: "a", meeting_at: "2026-11-18T09:00:00Z", attendees: ["haitham@metalfuze.local"] },
      { id: "b", meeting_at: "2026-11-19T09:00:00Z", attendees: ["haitham@metalfuze.local"] },
      { id: "c", meeting_at: "2026-11-10T09:00:00Z", attendees: ["haitham@metalfuze.local"] },
      { id: "d", meeting_at: "2026-11-20T09:00:00Z", attendees: ["ceo@metalfuze.local"] },
    ];
    expect(meetingsWaitingCount(ms, new Set(["b"]), "haitham@metalfuze.local", now)).toBe(1);
    expect(meetingsWaitingCount(ms, new Set(), "eilaf@metalfuze.local", now)).toBe(0);
  });
});
