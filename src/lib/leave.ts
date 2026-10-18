/** Leave helpers — dates in the HR file arrive as ISO text, d/m/yyyy text or Excel serials. */

export const LEAVE_COLS = ["رقم الموظف", "اسم الموظف", "القسم", "نوع الإجازة", "تاريخ البداية", "تاريخ النهاية", "عدد الأيام", "الحالة", "ملاحظات"];

export const localDay = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function toIso(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10);
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  return isNaN(Date.parse(s)) ? null : s.slice(0, 10);
}

export type LeaveStatus = "active" | "upcoming" | "ended";

/** Where a leave stands today: running, not started yet, or over. Null when no date is usable. */
export function leaveStatus(start: unknown, end: unknown, today = localDay()): LeaveStatus | null {
  const a = toIso(start);
  const b = toIso(end);
  if (!a && !b) return null;
  if (a && b) return b < today ? "ended" : a > today ? "upcoming" : "active";
  const only = (a ?? b)!;
  return only < today ? "ended" : only > today ? "upcoming" : "active";
}

/** Days covered, counting both end days; falls back to the count written in the sheet. */
export function leaveDays(start: unknown, end: unknown, stated: unknown): number {
  const a = toIso(start);
  const b = toIso(end);
  if (a && b) {
    const n = Math.round((Date.parse(b) - Date.parse(a)) / 86400000) + 1;
    if (n > 0) return n;
  }
  const n = Number(stated);
  return isNaN(n) ? 0 : n;
}

const DIM = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Last calendar day of a "YYYY-MM" month, leap years included. */
export function monthLast(month: string): string {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return `${month}-31`;
  const leap = m === 2 && (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0));
  return `${month}-${String(leap ? 29 : DIM[m - 1] ?? 31).padStart(2, "0")}`;
}

/** Days of a leave that fall inside one "YYYY-MM" month. */
export function daysInMonth(start: unknown, end: unknown, month: string): number {
  const a = toIso(start);
  const b = toIso(end);
  if (!a || !b) return 0;
  const first = `${month}-01`;
  const last = monthLast(month);
  const s = a < first ? first : a;
  const e = b > last ? last : b;
  if (e < s) return 0;
  return Math.round((Date.parse(e) - Date.parse(s)) / 86400000) + 1;
}
