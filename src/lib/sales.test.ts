import { describe, expect, it } from "vitest";
import { canApproveSalesStep, canCreateSalesDeal, canEditSalesAttachments, canEditSalesDeal, commissionDue } from "./sales";

describe("Haitham optional pricing amount", () => {
  it("allows approval with one pricing file and no amount", () => {
    expect(canApproveSalesStep("haitham_pricing", 1)).toBe(true);
    expect(canApproveSalesStep("haitham_pricing", 0)).toBe(false);
    // Quotation already attached via Eilaf's edit counts, so she can approve and send without re-uploading.
    expect(canApproveSalesStep("eilaf_quotation", 1)).toBe(true);
    expect(canApproveSalesStep("eilaf_quotation", 0)).toBe(false);
  });
});

describe("Eilaf sales permissions", () => {
  const eilaf = { id: "eilaf-id", email: "eilaf@metalfuze.local", emailConfirmed: true };
  it("allows Eilaf to create a deal and edit every request, including Hala's", () => {
    expect(canCreateSalesDeal("admin", eilaf)).toBe(true);
    expect(canEditSalesDeal("admin", eilaf, "eilaf-id")).toBe(true);
    expect(canEditSalesDeal("admin", eilaf, "hala-id")).toBe(true);
  });
  it("does not let an unconfirmed Eilaf email edit others' requests", () => {
    expect(canEditSalesDeal("admin", { ...eilaf, emailConfirmed: false }, "hala-id")).toBe(false);
  });
  it("does not grant other admins or unconfirmed emails deal editing", () => {
    expect(canCreateSalesDeal("admin", { ...eilaf, email: "other@metalfuze.local" })).toBe(false);
    expect(canCreateSalesDeal("admin", { ...eilaf, emailConfirmed: false })).toBe(false);
    expect(canCreateSalesDeal("admin", null)).toBe(false);
  });
  it("preserves owner-only editing for sales accounts", () => {
    const hala = { id: "hala-id", email: "hala@metalfuze.local" };
    expect(canEditSalesDeal("sales", hala, "hala-id")).toBe(true);
    expect(canEditSalesDeal("sales", hala, "eilaf-id")).toBe(false);
  });
  it("lets only verified Eilaf edit pricing and quotation files", () => {
    expect(canEditSalesAttachments(eilaf)).toBe(true);
    expect(canEditSalesAttachments({ ...eilaf, emailConfirmed: false })).toBe(false);
    expect(canEditSalesAttachments({ id: "hala-id", email: "hala@metalfuze.local", emailConfirmed: true })).toBe(false);
    expect(canEditSalesAttachments({ id: "h", email: "haitham@metalfuze.local", emailConfirmed: true })).toBe(false);
  });
});

describe("sales commission", () => {
  it("is 2% of the final contract value", () => {
    expect(commissionDue({ contract_value: 100000, commission_rate: 2 })).toBe(2000);
  });
  it("splits by share when another salesperson took part (50/50)", () => {
    expect(commissionDue({ contract_value: 100000, commission_rate: 2, shared: true, my_share: 50 })).toBe(1000);
  });
});
