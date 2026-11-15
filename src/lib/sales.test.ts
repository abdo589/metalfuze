import { describe, expect, it } from "vitest";
import { canApproveSalesStep, canCreateSalesDeal, canDeleteSalesDeal, canEditSalesAttachments, canEditSalesDeal, commissionDue, confirmedCommissionDue, needsCommissionConfirm } from "./sales";

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
  it("lets verified Eilaf delete any request, others only their own", () => {
    const hala = { id: "hala-id", email: "hala@metalfuze.local", emailConfirmed: true };
    expect(canDeleteSalesDeal("admin", eilaf, "hala-id")).toBe(true);
    expect(canDeleteSalesDeal("admin", { ...eilaf, emailConfirmed: false }, "hala-id")).toBe(false);
    expect(canDeleteSalesDeal("sales", hala, "hala-id")).toBe(true);
    expect(canDeleteSalesDeal("sales", hala, "eilaf-id")).toBe(false);
    expect(canDeleteSalesDeal("admin", { id: "h", email: "haitham@metalfuze.local", emailConfirmed: true }, "hala-id")).toBe(false);
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

describe("HR-approved commission", () => {
  it("earns nothing from a typed contract value until HR approves it", () => {
    expect(confirmedCommissionDue({ contract_value: 10_000_000 })).toBe(0);
    expect(needsCommissionConfirm({ contract_value: 10_000_000 })).toBe(true);
  });
  it("uses only the approved figures, even if the value is raised later", () => {
    const d = { contract_value: 900_000, confirmed_contract_value: 100_000, confirmed_commission_rate: 2, confirmed_shared: true, confirmed_my_share: 50, shared: true, my_share: 50 };
    expect(confirmedCommissionDue(d)).toBe(1000);
    expect(needsCommissionConfirm(d)).toBe(true);
    expect(needsCommissionConfirm({ ...d, contract_value: 100_000 })).toBe(false);
    expect(needsCommissionConfirm({ ...d, contract_value: 100_000, my_share: 100 })).toBe(true);
  });
  it("needs no approval without a contract value", () => {
    expect(needsCommissionConfirm({ contract_value: 0 })).toBe(false);
  });
});
