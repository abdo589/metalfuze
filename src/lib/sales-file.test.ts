import { describe, expect, it } from "vitest";
import { pricingAttachments, salesFilePath } from "./sales-file";

describe("sales pricing storage paths", () => {
  it("retains all pricing attachments without duplicating the legacy first file", () => {
    const files = [{ path: "haitham/one.xlsx", name: "تسعير.xlsx" }, { path: "haitham/two.dwg", name: "مخطط.dwg" }];
    expect(pricingAttachments({ pricing_files: files, pricing_file_path: "haitham/one.xlsx" })).toEqual(files);
  });
  it("still reads the original single pricing file", () => {
    expect(pricingAttachments({ pricing_file_path: "old/file.zip", pricing_file_name: "تسعير.zip", pricing_files: [] })).toEqual([{ path: "old/file.zip", name: "تسعير.zip" }]);
  });
  it("accepts an Arabic pricing filename as an ASCII key in the uploader's folder", () => {
    const path = salesFilePath("haitham-id", "ملف التسعير.xlsx");
    expect(path.split("/")[0]).toBe("haitham-id");
    expect(path).toMatch(/^[\x20-\x7E]+$/);
    expect(path.endsWith(".xlsx")).toBe(true);
  });
  it("preserves compressed file extensions without permitting folder traversal", () => {
    const path = salesFilePath("eilaf-id", "../عرض السعر.ZIP");
    expect(path.split("/")).toHaveLength(2);
    expect(path.endsWith(".zip")).toBe(true);
  });
  it("does not collide for two uploads with the same filename", () => {
    expect(salesFilePath("haitham-id", "تسعير.xlsx")).not.toBe(salesFilePath("haitham-id", "تسعير.xlsx"));
  });
});