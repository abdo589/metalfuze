import { describe, it, expect } from "vitest";
import { deviationLabel, deviationOf, deviationPct } from "./projects";

describe("deviationOf", () => {
  const b = { end: "2026-06-30", actualEnd: null };
  it("no end date, no deviation", () => expect(deviationOf({ end: null, actualEnd: null })).toBeNull());
  it("running within the period has no deviation yet", () => expect(deviationOf(b, "2026-05-01")).toBeNull());
  it("running past the end counts delay up to today", () => {
    expect(deviationOf(b, "2026-07-06")).toEqual({ days: 6, kind: "late", finished: false });
  });
  it("finished early counts days ahead", () => {
    expect(deviationOf({ ...b, actualEnd: "2026-06-16" }, "2026-07-01")).toEqual({ days: 14, kind: "early", finished: true });
  });
  it("finished late counts days of delay", () => {
    expect(deviationOf({ ...b, actualEnd: "2026-07-10" }, "2026-07-01")).toEqual({ days: 10, kind: "late", finished: true });
  });
  it("finished on the agreed day is on time", () => {
    expect(deviationOf({ ...b, actualEnd: "2026-06-30" }, "2026-07-01")).toEqual({ days: 0, kind: "ontime", finished: true });
  });
});

describe("deviationLabel", () => {
  it("delay shows days late", () => {
    expect(deviationLabel({ end: "2026-06-30", actualEnd: null }, "2026-07-06")).toBe("تأخير 6 يوم حتى الآن");
  });
  it("finished late shows days late without 'so far'", () => {
    expect(deviationLabel({ end: "2026-06-30", actualEnd: "2026-07-10" }, "2026-07-11")).toBe("تأخير 10 يوم");
  });
  it("finished early shows days ahead", () => {
    expect(deviationLabel({ end: "2026-06-30", actualEnd: "2026-06-16" }, "2026-07-01")).toBe("تقديم 14 يوم");
  });
  it("no deviation reads dash", () => {
    expect(deviationLabel({ end: null, actualEnd: null }, "2026-07-01")).toBe("—");
  });
});
