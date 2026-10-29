import { describe, expect, it } from "vitest";
import { canResubmit, isOverdue, latestRevisions, waitingDays } from "./cp";

const today = new Date("2026-10-29T12:00:00");
describe("submissions rules", () => {
  it("waiting days count only while awaiting reply", () => {
    expect(waitingDays({ status: "submitted", reply_date: null, submitted_date: "2026-10-20" }, today)).toBe(9);
    expect(waitingDays({ status: "replied", reply_date: "2026-10-25", submitted_date: "2026-10-20" }, today)).toBeNull();
  });
  it("overdue after more than 7 days without reply", () => {
    expect(isOverdue({ status: "under_review", reply_date: null, submitted_date: "2026-10-21" }, today)).toBe(true);
    expect(isOverdue({ status: "under_review", reply_date: null, submitted_date: "2026-10-22" }, today)).toBe(false);
  });
  it("resubmit only for codes C and D", () => {
    expect(["A", "B", "C", "D", null].map((code) => canResubmit({ code }))).toEqual([false, false, true, true, false]);
  });
  it("latest revision per chain", () => {
    const r = latestRevisions([{ id: "a", parent_id: null, revision: 0 }, { id: "b", parent_id: "a", revision: 1 }, { id: "c", parent_id: null, revision: 0 }] as never);
    expect(r.map((x) => x.id).sort()).toEqual(["b", "c"]);
  });
});

import { invLate, invoiceTotals, netOf } from "./cp";
describe("invoice rules", () => {
  it("net = amount minus retention", () => { expect(netOf(1000000, 10)).toBe(900000); });
  it("late only when unpaid more than 30 days", () => {
    expect(invLate({ status: "approved", submitted_date: "2026-09-28" }, today)).toBe(true);
    expect(invLate({ status: "approved", submitted_date: "2026-09-29" }, today)).toBe(false);
    expect(invLate({ status: "paid", submitted_date: "2026-01-01" }, today)).toBe(false);
  });
  it("totals exclude drafts and rejected; paid uses net", () => {
    const t = invoiceTotals(5000, [
      { status: "paid", amount: 1000, net_amount: 900 }, { status: "submitted", amount: 500, net_amount: 450 },
      { status: "rejected", amount: 700, net_amount: 630 }, { status: "draft", amount: 300, net_amount: 270 },
    ]);
    expect(t).toEqual({ contract: 5000, invoiced: 1500, paid: 900, remaining: 3500 });
  });
});
