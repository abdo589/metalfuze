import { describe, it, expect } from "vitest";
import { autoStatus, statusBucket, STATUS_BUCKETS } from "./projects";
const b = { start: "2026-01-01", end: "2026-06-30", status: "" };
describe("autoStatus", () => {
  it("running within agreed period is normal", () => expect(autoStatus(b, "2026-05-01")).toBe("طبيعي"));
  it("past end without finishing is late", () => expect(autoStatus(b, "2026-07-01")).toBe("متأخر"));
  it("finished early", () => expect(autoStatus({ ...b, actualEnd: "2026-06-01" })).toBe("منتهي - متقدم"));
  it("finished late", () => expect(autoStatus({ ...b, actualEnd: "2026-07-10" })).toBe("منتهي - متأخر"));
  it("finished on time", () => expect(autoStatus({ ...b, actualEnd: "2026-06-30" })).toBe("منتهي - طبيعي"));
});

describe("statusBucket", () => {
  it("groups the three finished statuses as finished", () => {
    expect(statusBucket("منتهي - متأخر")).toBe("منتهي");
    expect(statusBucket("منتهي - متقدم")).toBe("منتهي");
    expect(statusBucket("منتهي - طبيعي")).toBe("منتهي");
  });
  it("keeps running statuses in their own group", () => {
    expect(statusBucket("متأخر")).toBe("متأخر");
    expect(statusBucket("متقدم")).toBe("متقدم");
    expect(statusBucket("طبيعي")).toBe("طبيعي");
  });
  it("treats a missing or unknown status as on track", () => {
    expect(statusBucket("")).toBe("طبيعي");
    expect(statusBucket("قيد التنفيذ")).toBe("طبيعي");
  });
  it("always returns one of the four dashboard groups", () => {
    [...STATUS_BUCKETS, "منتهي - متأخر", ""].forEach((s) =>
      expect(STATUS_BUCKETS).toContain(statusBucket(s)));
  });
});
