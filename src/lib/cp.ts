import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type CpProject = Database["public"]["Tables"]["projects"]["Row"];
export type CpContract = Database["public"]["Tables"]["project_contracts"]["Row"];
export type CpMember = Database["public"]["Tables"]["project_members"]["Row"];

export const STATUSES = [
  { v: "planning", ar: "تخطيط", en: "Planning" },
  { v: "active", ar: "جاري", en: "Active" },
  { v: "on_hold", ar: "متوقف", en: "On hold" },
  { v: "completed", ar: "منتهي", en: "Completed" },
] as const;

export const ACCESS_ROLES = [
  { v: "admin", ar: "مدير النظام", en: "Admin" },
  { v: "project_manager", ar: "مدير مشروع", en: "Project manager" },
  { v: "site_engineer", ar: "مهندس موقع", en: "Site engineer" },
  { v: "document_controller", ar: "مراقب وثائق", en: "Document controller" },
  { v: "planner", ar: "مخطط", en: "Planner" },
  { v: "accountant", ar: "محاسب", en: "Accountant" },
  { v: "viewer", ar: "مشاهد", en: "Viewer" },
] as const;

export const JOBS = ["مدير مشروع", "مهندس موقع", "مشرف", "مدير سلامة", "مسؤول سلامة", "عمالة", "كهرباء", "ميكانيكا", "مقاول من الباطن", "مكتب فني", "أمين مخزن", "مراقب وثائق", "حارس"];

export const statusLabel = (v: string, lang: string) => {
  const s = STATUSES.find((x) => x.v === v);
  return s ? (lang === "en" ? s.en : s.ar) : v;
};

export const statusClass: Record<string, string> = {
  planning: "bg-secondary text-secondary-foreground",
  active: "bg-primary/15 text-primary",
  on_hold: "bg-destructive/15 text-destructive",
  completed: "bg-muted text-muted-foreground",
};

export const cpKeys = {
  projects: ["cp", "projects"] as const,
  project: (id: string) => ["cp", "project", id] as const,
  contract: (id: string) => ["cp", "contract", id] as const,
  members: (id: string) => ["cp", "members", id] as const,
  allMembers: ["cp", "members-count"] as const,
};

export async function fetchProjects() {
  const { data, error } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export type CpSubmission = Database["public"]["Tables"]["submissions"]["Row"];
export type CpAttachment = { path: string; name: string };

export const SUB_TYPES = [
  { v: "MIR", ar: "طلب فحص مواد MIR", en: "MIR" },
  { v: "SUB", ar: "تقديم Submittal", en: "Submittal" },
  { v: "SD", ar: "مخطط تنفيذي Shop Drawing", en: "Shop Drawing" },
  { v: "WIR", ar: "طلب استلام أعمال WIR", en: "WIR" },
  { v: "OTHER", ar: "أخرى", en: "Other" },
] as const;
export const DISCIPLINES = [
  { v: "civil", ar: "مدني", en: "Civil" },
  { v: "electrical", ar: "كهرباء", en: "Electrical" },
  { v: "mechanical", ar: "ميكانيكا", en: "Mechanical" },
  { v: "architectural", ar: "معماري", en: "Architectural" },
] as const;
export const SUB_STATUSES = [
  { v: "draft", ar: "مسودة", en: "Draft" },
  { v: "submitted", ar: "مُقدم", en: "Submitted" },
  { v: "under_review", ar: "تحت المراجعة", en: "Under review" },
  { v: "replied", ar: "تم الرد", en: "Replied" },
] as const;
export const CODES = [
  { v: "A", ar: "معتمد", en: "Approved" },
  { v: "B", ar: "معتمد بملاحظات", en: "Approved as noted" },
  { v: "C", ar: "يُعدل ويُعاد تقديمه", en: "Revise & resubmit" },
  { v: "D", ar: "مرفوض", en: "Rejected" },
] as const;
export const codeClass: Record<string, string> = {
  A: "bg-chart-2/20 text-chart-2 border-chart-2/40",
  B: "bg-chart-1/20 text-chart-1 border-chart-1/40",
  C: "bg-chart-4/20 text-chart-4 border-chart-4/40",
  D: "bg-destructive/15 text-destructive border-destructive/40",
};
export const codeColorVar: Record<string, string> = { A: "var(--chart-2)", B: "var(--chart-1)", C: "var(--chart-4)", D: "var(--destructive)" };
export const pick = (list: readonly { v: string; ar: string; en: string }[], v: string | null, lang: string) => {
  const x = list.find((i) => i.v === v);
  return x ? (lang === "en" ? x.en : x.ar) : (v ?? "—");
};

/** Pending = sent to the consultant and still waiting for a reply. */
export const isPending = (s: Pick<CpSubmission, "status" | "reply_date">) => (s.status === "submitted" || s.status === "under_review") && !s.reply_date;

/** Days since submission while waiting for a reply; null when not waiting. */
export function waitingDays(s: Pick<CpSubmission, "status" | "reply_date" | "submitted_date">, today = new Date()): number | null {
  if (!isPending(s) || !s.submitted_date) return null;
  const start = new Date(s.submitted_date + "T00:00:00");
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(0, Math.round((t.getTime() - start.getTime()) / 86400000));
}
export const OVERDUE_DAYS = 7;
export const isOverdue = (s: Pick<CpSubmission, "status" | "reply_date" | "submitted_date">, today = new Date()) => (waitingDays(s, today) ?? 0) > OVERDUE_DAYS;

/** Latest revision of each document chain (original + its resubmissions). */
export function latestRevisions(rows: CpSubmission[]) {
  const m = new Map<string, CpSubmission>();
  for (const r of rows) {
    const k = r.parent_id ?? r.id;
    const cur = m.get(k);
    if (!cur || r.revision > cur.revision) m.set(k, r);
  }
  return [...m.values()];
}
export const canResubmit = (s: Pick<CpSubmission, "code">) => s.code === "C" || s.code === "D";

export type CpInvoice = Database["public"]["Tables"]["invoices"]["Row"];
export type CpInvoiceNote = Database["public"]["Tables"]["invoice_notes"]["Row"];
export const INV_STATUSES = [
  { v: "draft", ar: "مسودة", en: "Draft" },
  { v: "submitted", ar: "مُقدم", en: "Submitted" },
  { v: "approved", ar: "معتمد", en: "Approved" },
  { v: "paid", ar: "مدفوع", en: "Paid" },
  { v: "rejected", ar: "مرفوض", en: "Rejected" },
] as const;
export const invStatusClass: Record<string, string> = {
  draft: "bg-muted text-muted-foreground", submitted: "bg-chart-1/20 text-chart-1", approved: "bg-chart-4/20 text-chart-4",
  paid: "bg-chart-2/20 text-chart-2", rejected: "bg-destructive/15 text-destructive",
};
export const INVOICE_LATE_DAYS = 30;
export const netOf = (amount: number, pct: number) => Math.round(amount * (1 - pct / 100) * 100) / 100;
/** Pending = submitted or approved, not yet paid. */
export const invPending = (i: Pick<CpInvoice, "status">) => i.status === "submitted" || i.status === "approved";
export function invLate(i: Pick<CpInvoice, "status" | "submitted_date">, today = new Date()) {
  if (!invPending(i) || !i.submitted_date) return false;
  const d = (new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() - new Date(i.submitted_date + "T00:00:00").getTime()) / 86400000;
  return d > INVOICE_LATE_DAYS;
}
export function invoiceTotals(contractValue: number, list: Pick<CpInvoice, "status" | "amount" | "net_amount">[]) {
  const live = list.filter((i) => i.status !== "rejected" && i.status !== "draft");
  const invoiced = live.reduce((s, i) => s + Number(i.amount), 0);
  const paid = list.filter((i) => i.status === "paid").reduce((s, i) => s + Number(i.net_amount ?? 0), 0);
  return { contract: contractValue, invoiced, paid, remaining: contractValue - invoiced };
}
export const sar = (n: number, lang: string) => new Intl.NumberFormat(lang === "en" ? "en-US" : "ar-SA", { maximumFractionDigits: 2 }).format(n) + (lang === "en" ? " SAR" : " ر.س");

export type CpActivity = Database["public"]["Tables"]["schedule_activities"]["Row"];
export type CpDaily = Database["public"]["Tables"]["daily_reports"]["Row"];
export const TRADES = ["مدني", "كهرباء", "ميكانيكا", "معماري", "سلامة", "مقاول من الباطن"];
export const WEATHER = ["مشمس", "غائم", "ممطر", "مغبر", "عاصفة ترابية", "حار جدًا"];

const DAY = 86400000;
const d0 = (s: string) => new Date(s + "T00:00:00Z").getTime();
export const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
export const daysBetween = (a: string, b: string) => Math.round((d0(b) - d0(a)) / DAY);

/** Overall schedule progress, weighted by each activity's duration in days. */
export function scheduleProgress(acts: Pick<CpActivity, "start_date" | "end_date" | "progress">[]) {
  let w = 0, s = 0;
  for (const a of acts) { const d = daysBetween(a.start_date, a.end_date) + 1; w += d; s += d * Number(a.progress); }
  return w ? Math.round((s / w) * 10) / 10 : 0;
}
/** Planned progress at a date: share of each activity's duration already elapsed. */
export function plannedProgress(acts: Pick<CpActivity, "start_date" | "end_date">[], at: string) {
  let w = 0, s = 0;
  for (const a of acts) {
    const d = daysBetween(a.start_date, a.end_date) + 1; w += d;
    s += d * Math.min(1, Math.max(0, (daysBetween(a.start_date, at) + 1) / d)) * 100;
  }
  return w ? Math.round((s / w) * 10) / 10 : 0;
}
export function ganttRange(acts: Pick<CpActivity, "start_date" | "end_date">[]) {
  if (!acts.length) return null;
  const start = acts.reduce((m, a) => (a.start_date < m ? a.start_date : m), acts[0]!.start_date);
  const end = acts.reduce((m, a) => (a.end_date > m ? a.end_date : m), acts[0]!.end_date);
  return { start, end, days: daysBetween(start, end) + 1 };
}
/** Monday-start week containing the date. */
export function weekOf(date: string) {
  const t = d0(date); const wd = (new Date(t).getUTCDay() + 6) % 7;
  return { from: iso(t - wd * DAY), to: iso(t + (6 - wd) * DAY) };
}
export function monthOf(date: string) {
  const [y = 2000, m = 1] = date.split("-").map(Number);
  return { from: `${y}-${String(m).padStart(2, "0")}-01`, to: iso(Date.UTC(y, m, 0)) };
}
const inR = (d: string | null, from: string, to: string) => !!d && d >= from && d <= to;

export function periodReport(
  input: { daily: CpDaily[]; subs: CpSubmission[]; invoices: CpInvoice[]; acts: CpActivity[] },
  from: string, to: string,
) {
  const daily = input.daily.filter((r) => inR(r.report_date, from, to)).sort((a, b) => a.report_date.localeCompare(b.report_date));
  const manpower: Record<string, number> = {};
  for (const r of daily) for (const [k, v] of Object.entries((r.manpower ?? {}) as Record<string, number>)) manpower[k] = (manpower[k] ?? 0) + Number(v || 0);
  const totalManDays = Object.values(manpower).reduce((a, b) => a + b, 0);
  const subsIn = input.subs.filter((s) => inR(s.submitted_date, from, to) || inR(s.reply_date, from, to));
  const docs = subsIn.filter((s) => s.type !== "WIR");
  const wirs = subsIn.filter((s) => s.type === "WIR");
  const codes = { A: 0, B: 0, C: 0, D: 0 } as Record<string, number>;
  for (const s of subsIn) if (s.code && inR(s.reply_date, from, to)) codes[s.code] = (codes[s.code] ?? 0) + 1;
  const invoices = input.invoices.filter((i) => inR(i.submitted_date, from, to) || inR(i.paid_date, from, to));
  const invoiced = invoices.filter((i) => inR(i.submitted_date, from, to) && i.status !== "draft" && i.status !== "rejected").reduce((s, i) => s + Number(i.amount), 0);
  const paid = invoices.filter((i) => i.status === "paid" && inR(i.paid_date, from, to)).reduce((s, i) => s + Number(i.net_amount ?? 0), 0);
  const acts = input.acts.filter((a) => a.start_date <= to && a.end_date >= from);
  return {
    from, to, daily, manpower, totalManDays, docs, wirs, codes, invoices, invoiced, paid, acts,
    actual: scheduleProgress(input.acts), planned: plannedProgress(input.acts, to),
    issues: daily.filter((r) => r.issues.trim()).map((r) => ({ date: r.report_date, text: r.issues })),
  };
}
