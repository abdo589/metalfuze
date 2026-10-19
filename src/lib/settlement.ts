/** Saudi Labor Law end-of-service award (Articles 84/85). */
export function serviceYears(joined: string | null, lastDay: string): number {
  if (!joined) return 0;
  const ms = new Date(lastDay).getTime() - new Date(joined).getTime();
  return Math.max(0, ms / (365.25 * 86400_000));
}

export function fullAward(wage: number, years: number): number {
  const first = Math.min(years, 5) * wage * 0.5;
  const rest = Math.max(0, years - 5) * wage;
  return first + rest;
}

/** Share of the full award paid for a given reason (stored Arabic status label). */
export function awardShare(reason: string, years: number): number {
  if (reason.includes("المادة 80")) return 0;
  if (reason.includes("الاستقالة")) {
    if (years < 2) return 0;
    if (years < 5) return 1 / 3;
    if (years < 10) return 2 / 3;
  }
  return 1;
}

export function endOfService(wage: number, joined: string | null, lastDay: string, reason: string): number {
  const y = serviceYears(joined, lastDay);
  return Math.round(fullAward(wage, y) * awardShare(reason, y) * 100) / 100;
}

/** Unused leave paid at daily wage = monthly wage / 30. */
export const leavePay = (wage: number, days: number) => Math.round((wage / 30) * days * 100) / 100;

export const SETTLEMENT_STATUSES = [
  { key: "draft", label: "مسودة", cls: "bg-muted text-muted-foreground" },
  { key: "review", label: "بانتظار المراجعة", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  { key: "mgmt", label: "بانتظار اعتماد الإدارة", cls: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  { key: "approved", label: "معتمدة", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  { key: "paid", label: "تم الصرف", cls: "bg-violet-500/15 text-violet-700 dark:text-violet-300" },
  { key: "cancelled", label: "ملغاة", cls: "bg-destructive/15 text-destructive" },
] as const;
