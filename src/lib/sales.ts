/** Commission = final contract value (pre-VAT) × rate (default 2%) × this salesperson's share. */
export function commissionDue(d: { contract_value?: number | string | null; commission_rate?: number | string | null; shared?: boolean | null; my_share?: number | string | null }) {
  const share = d.shared ? Number(d.my_share ?? 100) / 100 : 1;
  return Number(d.contract_value ?? 0) * (Number(d.commission_rate ?? 2) / 100) * share;
}
