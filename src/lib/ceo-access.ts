/** The CEO account and Haitham share every CEO right (approvals, payments, pages, messages). Display/UI only — the database re-checks. */
export const CEO_EMAIL = "ceo@metalfuze.local";
export const HAITHAM_EMAIL = "haitham@metalfuze.local";
export const CEO_ACCESS_EMAILS = [CEO_EMAIL, HAITHAM_EMAIL];

export function hasCeoAccess(email?: string | null) {
  return !!email && CEO_ACCESS_EMAILS.includes(email.toLowerCase());
}

/** Whether this account acts on a sales approval step (the CEO step is shared with Haitham). */
export function canActOnSalesStep(step: string, stepEmail: string | undefined, myEmail?: string | null) {
  if (!myEmail) return false;
  if (stepEmail && stepEmail === myEmail.toLowerCase()) return true;
  return step === "ceo_approval" && hasCeoAccess(myEmail);
}
