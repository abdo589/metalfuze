import { describe, expect, it } from "vitest";
import { resolveEmployeeStatus, statusLabel, statusOptions } from "./employee-status";

describe("employee statuses", () => {
  it("resolves the legacy resigned marker to Resignation", () => {
    expect(resolveEmployeeStatus("مستقيل")?.key).toBe("resignation");
  });

  it("resolves the old bilingual stored value", () => {
    expect(resolveEmployeeStatus("إنهاء العقد وفق المادة 80 — Termination Under Article 80")?.key).toBe("article_80");
  });

  it("resolves a stored English value", () => {
    expect(resolveEmployeeStatus("Resignation")?.key).toBe("resignation");
  });

  it("shows the Arabic label in Arabic and the English label in English", () => {
    expect(statusLabel("الاستقالة", "ar")).toBe("الاستقالة");
    expect(statusLabel("الاستقالة", "en")).toBe("Resignation");
    expect(statusLabel("مستقيل", "en")).toBe("Resignation");
  });

  it("returns null for active or empty statuses", () => {
    expect(statusLabel("على رأس العمل", "ar")).toBeNull();
    expect(statusLabel("", "en")).toBeNull();
  });

  it("stores the canonical Arabic value in both languages", () => {
    expect(statusOptions("ar")).toEqual(statusOptions("en"));
    expect(statusOptions("en").find((o) => o.value === "الاستقالة")?.label).toBe("Resignation");
  });
});
