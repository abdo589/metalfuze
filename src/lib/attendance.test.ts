import { describe, expect, it, vi } from "vitest";
import { buildDays, parseAttlog } from "./attendance";

describe("attendance rules", () => {
  it("arrival at 09:30 is on time", () => {
    const d = buildDays([{ device_user_id: "1", punched_at: "2026-10-15T09:30:00+03:00" }], "1");
    expect(d[0]!.late).toBe(false);
  });
  it("arrival at 09:31 is late", () => {
    const d = buildDays([{ device_user_id: "1", punched_at: "2026-10-15T09:31:00+03:00" }], "1");
    expect(d[0]!.late).toBe(true);
  });
  it("first punch is check-in, last is check-out", () => {
    const d = buildDays([
      { device_user_id: "1", punched_at: "2026-10-15T17:05:00+03:00" },
      { device_user_id: "1", punched_at: "2026-10-15T08:55:00+03:00" },
    ], "1");
    expect(d[0]).toMatchObject({ in: "08:55", out: "17:05" });
  });
  it("parses ZKTeco ATTLOG lines", () => {
    expect(parseAttlog("12\t2026-10-15 09:02:11\t0\t1\n")).toEqual([
      { device_user_id: "12", punched_at: "2026-10-15T09:02:11+03:00", status: 0 },
    ]);
  });
  it("excused late day is not counted late", () => {
    const d = buildDays([{ device_user_id: "1", punched_at: "2026-10-15T10:15:00+03:00" }], "1", new Set(["2026-10-15"]));
    expect(d[0]!.late).toBe(false);
    expect(d[0]!.excused).toBe(true);
  });
});

import { summarize } from "./attendance";
describe("absence is counted day by day", () => {
  it("does not count days before attendance started", () => {
    const e = { id: "9", deviceUserId: "9", joined: "2026-01-01" } as any;
    const p = [{ device_user_id: "9", punched_at: "2026-10-21T09:00:00+03:00" }];
    // Wed 21 Oct present, Thu 22 Oct absent; 1-20 Oct were before any recording.
    vi.useFakeTimers({ now: new Date("2026-10-23T12:00:00+03:00") });
    try {
      const s = summarize(e, p, "2026-10");
      expect(s.absent).toBe(1);
    } finally { vi.useRealTimers(); }
  });
});
