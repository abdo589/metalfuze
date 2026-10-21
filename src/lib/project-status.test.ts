import { describe, it, expect } from "vitest";
import { autoStatus } from "./projects";
const b = { start: "2026-01-01", end: "2026-06-30", status: "" };
describe("autoStatus", () => {
  it("running within agreed period is normal", () => expect(autoStatus(b, "2026-05-01")).toBe("طبيعي"));
  it("past end without finishing is late", () => expect(autoStatus(b, "2026-07-01")).toBe("متأخر"));
  it("finished early", () => expect(autoStatus({ ...b, actualEnd: "2026-06-01" })).toBe("منتهي - متقدم"));
  it("finished late", () => expect(autoStatus({ ...b, actualEnd: "2026-07-10" })).toBe("منتهي - متأخر"));
  it("finished on time", () => expect(autoStatus({ ...b, actualEnd: "2026-06-30" })).toBe("منتهي - طبيعي"));
});
