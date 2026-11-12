type SalesActor = { id: string; email: string; emailConfirmed?: boolean };

/** Price is optional; pricing and quotation approvals still require an uploaded file. */
export function canApproveSalesStep(step: string, fileCount: number) {
  return !["haitham_pricing", "eilaf_quotation"].includes(step) || fileCount > 0;
}

/** Display permissions mirror owner-scoped database policies; never substitute for RLS. */
export function canCreateSalesDeal(role: string | null | undefined, actor: SalesActor | null) {
  return !!actor && (role === "sales" || (actor.emailConfirmed === true && actor.email.toLowerCase() === "eilaf@metalfuze.local"));
}

export function isSalesReviewer(actor: SalesActor | null) {
  return !!actor && actor.emailConfirmed === true && actor.email.toLowerCase() === "eilaf@metalfuze.local";
}

/** Eilaf edits every pricing request; everyone else edits only their own. */
export function canEditSalesDeal(role: string | null | undefined, actor: SalesActor | null, ownerId: string) {
  return canCreateSalesDeal(role, actor) && (actor?.id === ownerId || isSalesReviewer(actor));
}

/** Sales accounts delete only their own requests; verified Eilaf deletes any request. */
export function canDeleteSalesDeal(role: string | null | undefined, actor: SalesActor | null, ownerId: string) {
  return !!actor && ((role === "sales" && actor.id === ownerId) || isSalesReviewer(actor));
}

/** Only Eilaf (verified) may add or unlink pricing/quotation files after they were attached. */
export function canEditSalesAttachments(actor: SalesActor | null) {
  return isSalesReviewer(actor);
}

/** Commission = final contract value (pre-VAT) × rate (default 2%) × this salesperson's share. */
export function commissionDue(d: { contract_value?: number | string | null; commission_rate?: number | string | null; shared?: boolean | null; my_share?: number | string | null }) {
  const share = d.shared ? Number(d.my_share ?? 100) / 100 : 1;
  return Number(d.contract_value ?? 0) * (Number(d.commission_rate ?? 2) / 100) * share;
}
