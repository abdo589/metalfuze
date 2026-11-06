import { describe, expect, it, vi } from "vitest";
import { openSalesFile } from "./sales-file-open";

function setup() {
  const tab = { location: { href: "about:blank" }, opener: {}, close: vi.fn() };
  return { tab, browser: { open: vi.fn(() => tab), navigate: vi.fn() } };
}

describe("sales file opening", () => {
  it("reserves the PDF tab before signing and removes opener access", async () => {
    const { tab, browser } = setup();
    const sign = vi.fn(async (download: boolean) => {
      expect(browser.open).toHaveBeenCalledOnce();
      expect(tab.opener).toBeNull();
      expect(download).toBe(false);
      return "https://example.test/file.pdf";
    });
    await openSalesFile("تسعير.PDF", sign, false, browser);
    expect(tab.location.href).toBe("https://example.test/file.pdf");
  });

  it.each(["تسعير.xlsx", "عرض.docx", "رسومات.dwg", "ملفات.zip", "unknown"])("downloads %s without a blank tab", async (name) => {
    const { browser } = setup();
    const sign = vi.fn(async () => "https://example.test/download");
    await openSalesFile(name, sign, false, browser);
    expect(browser.open).not.toHaveBeenCalled();
    expect(sign).toHaveBeenCalledWith(true);
    expect(browser.navigate).toHaveBeenCalledWith("https://example.test/download");
  });

  it("allows explicit PDF download", async () => {
    const { browser } = setup();
    const sign = vi.fn(async () => "https://example.test/download");
    await openSalesFile("تسعير.pdf", sign, true, browser);
    expect(sign).toHaveBeenCalledWith(true);
    expect(browser.open).not.toHaveBeenCalled();
  });

  it("closes the reserved tab and reports signing failures", async () => {
    const { tab, browser } = setup();
    await expect(openSalesFile("test.pdf", async () => { throw new Error("denied"); }, false, browser)).rejects.toThrow("denied");
    expect(tab.close).toHaveBeenCalledOnce();
    expect(browser.navigate).not.toHaveBeenCalled();
  });

  it("falls back to the current window if popups are blocked", async () => {
    const browser = { open: () => null, navigate: vi.fn() };
    await openSalesFile("test.pdf", async () => "https://example.test/file.pdf", false, browser);
    expect(browser.navigate).toHaveBeenCalledWith("https://example.test/file.pdf");
  });
});