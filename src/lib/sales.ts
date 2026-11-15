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

type ConfirmedDeal = {
  contract_value?: number | string | null; shared?: boolean | null; my_share?: number | string | null;
  confirmed_contract_value?: number | string | null; confirmed_commission_rate?: number | string | null;
  confirmed_shared?: boolean | null; confirmed_my_share?: number | string | null;
};

/** HR-recorded commission uses only the HR-approved snapshot; unapproved typed values earn nothing. */
export function confirmedCommissionDue(d: ConfirmedDeal) {
  if (d.confirmed_contract_value == null) return 0;
  return commissionDue({ contract_value: d.confirmed_contract_value, commission_rate: d.confirmed_commission_rate, shared: d.confirmed_shared, my_share: d.confirmed_my_share });
}

/** A deal with a contract value needs HR approval when nothing, or different figures, were approved. */
export function needsCommissionConfirm(d: ConfirmedDeal) {
  if (!(Number(d.contract_value ?? 0) > 0)) return false;
  if (d.confirmed_contract_value == null) return true;
  return Number(d.confirmed_contract_value) !== Number(d.contract_value) || !!d.confirmed_shared !== !!d.shared
    || (!!d.shared && Number(d.confirmed_my_share ?? 100) !== Number(d.my_share ?? 100));
}
