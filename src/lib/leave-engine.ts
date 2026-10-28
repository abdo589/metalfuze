/** Pure leave rules shared by the leave pages, attendance and payroll. The database re-checks everything on save. */

export type LeaveState = "draft" | "pending_manager" | "pending_hr" | "approved" | "rejected" | "cancelled";

export const LEAVE_STATES: { key: LeaveState; ar: string; en: string }[] = [
  { key: "draft", ar: "مسودة", en: "Draft" },
  { key: "pending_manager", ar: "بانتظار موافقة المدير", en: "Awaiting manager" },
  { key: "pending_hr", ar: "بانتظار مراجعة HR", en: "Awaiting HR review" },
  { key: "approved", ar: "معتمد", en: "Approved" },
  { key: "rejected", ar: "مرفوض", en: "Rejected" },
  { key: "cancelled", ar: "ملغي", en: "Cancelled" },
];

export const stateLabel = (s: string, lang: "ar" | "en") => {
  const d = LEAVE_STATES.find((x) => x.key === s);
  return d ? (lang === "en" ? d.en : d.ar) : s;
};

export type LeaveType = {
  id: string; name_ar: string; name_en: string; paid: boolean; uses_balance: boolean;
  max_days: number | null; requires_attachment: boolean; calendar_days: boolean; active: boolean; sort: number;
};

export type LeaveRequest = {
  id: string; request_no: number; employee_id: string; type_id: string; start_date: string; end_date: string;
  working_days: number; return_date: string | null; reason: string; attachment_path: string | null;
  attachment_name: string | null; status: LeaveState; manager_note: string | null; hr_note: string | null;
  via: string; created_at: string; updated_at: string;
};

export type Tier = { years: number; days: number };

const iso = (d: Date) => d.toISOString().slice(0, 10);
const utc = (s: string) => new Date(`${s}T00:00:00Z`);

/** Every date from start to end (inclusive). */
export function eachDay(start: string, end: string): string[] {
  const out: string[] = [];
  if (!start || !end || end < start) return out;
  for (let d = utc(start); iso(d) <= end; d.setUTCDate(d.getUTCDate() + 1)) out.push(iso(d));
  return out;
}

/** Days the leave costs: working days only, or every day for calendar-day types (e.g. maternity). */
export function countLeaveDays(start: string, end: string, weekend: number[], calendar = false): number {
  return eachDay(start, end).filter((d) => calendar || !weekend.includes(utc(d).getUTCDay())).length;
}

/** First working day after the leave ends. */
export function returnDate(end: string, weekend: number[]): string {
  const d = utc(end);
  for (let i = 0; i < 10; i++) { d.setUTCDate(d.getUTCDate() + 1); if (!weekend.includes(d.getUTCDay())) return iso(d); }
  return iso(d);
}

/** Annual entitlement for someone with this many full years of service. */
export function entitlementFor(years: number, tiers: Tier[]): number {
  const t = [...tiers].sort((a, b) => b.years - a.years).find((x) => years >= x.years);
  return t?.days ?? 0;
}

/** Full years between two ISO dates. */
export function serviceYears(joined: string | null, on: string): number {
  if (!joined) return 0;
  const a = utc(joined), b = utc(on);
  let y = b.getUTCFullYear() - a.getUTCFullYear();
  if (b.getUTCMonth() < a.getUTCMonth() || (b.getUTCMonth() === a.getUTCMonth() && b.getUTCDate() < a.getUTCDate())) y--;
  return Math.max(0, y);
}

/** Active requests (not rejected / cancelled) that overlap the given range. */
export function overlaps(reqs: Pick<LeaveRequest, "id" | "employee_id" | "start_date" | "end_date" | "status">[], emp: string, start: string, end: string, ignoreId?: string) {
  return reqs.filter((r) => r.employee_id === emp && r.id !== ignoreId && r.status !== "rejected" && r.status !== "cancelled"
    && r.start_date <= end && r.end_date >= start);
}

/** Approved leave dates per employee — attendance treats these days as leave, not absence. */
export function approvedLeaveDates(reqs: Pick<LeaveRequest, "employee_id" | "start_date" | "end_date" | "status">[]): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  for (const r of reqs) {
    if (r.status !== "approved") continue;
    const s = m.get(r.employee_id) ?? new Set<string>();
    for (const d of eachDay(r.start_date, r.end_date)) s.add(d);
    m.set(r.employee_id, s);
  }
  return m;
}

/** Unpaid-leave days of one employee inside a "YYYY-MM" month (calendar days, as salary is monthly / 30). */
export function unpaidDaysInMonth(reqs: Pick<LeaveRequest, "employee_id" | "start_date" | "end_date" | "status" | "type_id">[], types: Pick<LeaveType, "id" | "paid">[], emp: string, month: string): number {
  const unpaid = new Set(types.filter((t) => !t.paid).map((t) => t.id));
  let n = 0;
  for (const r of reqs) {
    if (r.employee_id !== emp || r.status !== "approved" || !unpaid.has(r.type_id)) continue;
    n += eachDay(r.start_date, r.end_date).filter((d) => d.startsWith(month)).length;
  }
  return Math.min(n, 30);
}

/** Pro-rata deduction for unpaid leave: monthly gross / 30 per day. */
export const unpaidDeduction = (monthlyGross: number, days: number) => Math.round((monthlyGross / 30) * days * 100) / 100;

/** Readable message for a database rule rejection. */
export function leaveError(message: string | undefined): string {
  const m = message ?? "";
  if (m.includes("LEAVE_OVERLAP")) return "يوجد طلب إجازة آخر في نفس الفترة";
  if (m.includes("LEAVE_DATES")) return "تاريخ النهاية قبل تاريخ البداية";
  if (m.includes("LEAVE_NO_WORKDAYS")) return "الفترة المختارة لا تحتوي أيام عمل";
  if (m.includes("LEAVE_ATTACHMENT")) return "هذا النوع يحتاج مرفقًا (مثل التقرير الطبي)";
  if (m.includes("LEAVE_MAX_DAYS")) return "عدد الأيام أكبر من الحد المسموح لهذا النوع";
  if (m.includes("LEAVE_OVERLAP")) return "يوجد طلب إجازة آخر في نفس الفترة";
  if (m.includes("LEAVE_BALANCE")) return "الرصيد المتبقي لا يكفي لهذا الطلب";
  if (m.includes("LEAVE_REASON")) return "اكتب السبب أولًا";
  if (m.includes("LEAVE_FORBIDDEN")) return "ليس لديك صلاحية لهذا الإجراء";
  if (m.includes("LEAVE_STATE")) return "حالة الطلب لا تسمح بهذا الإجراء";
  if (m.includes("LEAVE_EMPLOYEE")) return "الموظف غير نشط";
  return "تعذر الحفظ";
}
