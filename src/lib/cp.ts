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
