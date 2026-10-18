export const ACTIVE_STATUS = "على رأس العمل";

export const END_STATUSES = [
  "انتهاء العقد بانتهاء مدته — Contract Expiry",
  "عدم تجديد العقد — Non-Renewal of Contract",
  "الاستقالة — Resignation",
  "إنهاء العقد بالتراضي — Mutual Termination",
  "إنهاء العقد من قبل صاحب العمل — Employer-Initiated Termination",
  "إنهاء العقد خلال فترة التجربة — Probationary Period Termination",
  "إنهاء العقد وفق المادة 80 — Termination Under Article 80",
  "إنهاء العقد وفق المادة 77 — Termination Under Article 77",
  "ترك العمل وفق المادة 81 — Termination Under Article 81",
];

export const STATUS_OPTIONS = [ACTIVE_STATUS, ...END_STATUSES];

/** Short Arabic label for the tag, or null when the employee is still working. */
export function endedLabel(status: unknown): string | null {
  const s = String(status ?? "").trim();
  if (!s) return null;
  if (s.includes("مستقيل")) return "مستقيل";
  if (END_STATUSES.includes(s)) return s.split(" — ")[0]!;
  return null;
}
