import type { Language } from "@/lib/i18n";

export interface EmployeeStatusDef {
  /** Stable key used internally; the stored value stays the Arabic label. */
  key: string;
  ar: string;
  en: string;
}

/** Canonical stored value for "still working". */
export const ACTIVE_STATUS = "على رأس العمل";

export const EMPLOYEE_STATUSES: EmployeeStatusDef[] = [
  { key: "active", ar: "على رأس العمل", en: "Active" },
  { key: "contract_expiry", ar: "انتهاء العقد بانتهاء مدته", en: "Contract Expiry" },
  { key: "non_renewal", ar: "عدم تجديد العقد", en: "Non-Renewal of Contract" },
  { key: "resignation", ar: "الاستقالة", en: "Resignation" },
  { key: "mutual_termination", ar: "إنهاء العقد بالتراضي", en: "Mutual Termination" },
  { key: "employer_termination", ar: "إنهاء العقد من قبل صاحب العمل", en: "Employer-Initiated Termination" },
  { key: "probation_termination", ar: "إنهاء العقد خلال فترة التجربة", en: "Probationary Period Termination" },
  { key: "article_80", ar: "إنهاء العقد وفق المادة 80", en: "Termination Under Article 80" },
  { key: "article_77", ar: "إنهاء العقد وفق المادة 77", en: "Termination Under Article 77" },
  { key: "article_81", ar: "ترك العمل وفق المادة 81", en: "Termination Under Article 81" },
];

/** Resolve any stored status text — Arabic, English, the old bilingual "ar — en" form, or "مستقيل" — to its definition. */
export function resolveEmployeeStatus(raw: unknown): EmployeeStatusDef | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const direct = EMPLOYEE_STATUSES.find(
    (d) => d.key === s || d.ar === s || d.en.toLowerCase() === s.toLowerCase(),
  );
  if (direct) return direct;
  const arPart = s.split("—")[0]!.trim();
  const byAr = EMPLOYEE_STATUSES.find((d) => d.ar === arPart);
  if (byAr) return byAr;
  const byEn = EMPLOYEE_STATUSES.find((d) => s.toLowerCase().includes(d.en.toLowerCase()));
  if (byEn) return byEn;
  if (s.includes("مستقيل")) return EMPLOYEE_STATUSES.find((d) => d.key === "resignation")!;
  return null;
}

/** Localized label for a stored status, or null when the employee is still working or the value is unknown. */
export function statusLabel(raw: unknown, lang: Language): string | null {
  const def = resolveEmployeeStatus(raw);
  if (!def || def.key === "active") return null;
  return lang === "en" ? def.en : def.ar;
}

/** Dropdown options: stored value is always the canonical Arabic label; the label shown follows the language. */
export function statusOptions(lang: Language): { value: string; label: string }[] {
  return EMPLOYEE_STATUSES.map((d) => ({ value: d.ar, label: lang === "en" ? d.en : d.ar }));
}
