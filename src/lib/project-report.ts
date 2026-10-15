import { addDays, addMonths, addYears, endOfMonth, endOfWeek, endOfYear, format, startOfMonth, startOfWeek, startOfYear } from "date-fns";
import type { Project } from "./projects";

export type ReportPeriod = "weekly" | "monthly" | "yearly";
export const periodLabels: Record<ReportPeriod, string> = { weekly: "أسبوعي", monthly: "شهري", yearly: "سنوي" };
export function periodRange(period: ReportPeriod, anchor: Date) {
  const start = period === "weekly" ? startOfWeek(anchor, { weekStartsOn: 1 }) : period === "monthly" ? startOfMonth(anchor) : startOfYear(anchor);
  const end = period === "weekly" ? endOfWeek(anchor, { weekStartsOn: 1 }) : period === "monthly" ? endOfMonth(anchor) : endOfYear(anchor);
  return { start, end, from: format(start, "yyyy-MM-dd"), to: format(end, "yyyy-MM-dd") };
}
export function shiftPeriod(period: ReportPeriod, anchor: Date, delta: number) {
  return period === "weekly" ? addDays(anchor, delta * 7) : period === "monthly" ? addMonths(anchor, delta) : addYears(anchor, delta);
}
export function buildProjectReport(projects: Project[], period: ReportPeriod, anchor: Date, today: string) {
  const range = periodRange(period, anchor);
  const rows = projects.filter((p) => (!p.start || p.start <= range.to) && (!p.end || p.end >= range.from));
  const contract = rows.reduce((sum, p) => sum + (p.contract || 0), 0);
  const paid = rows.reduce((sum, p) => sum + (p.paid || 0), 0);
  const average = rows.length ? rows.reduce((sum, p) => sum + p.progress, 0) / rows.length : 0;
  const delayed = rows.filter((p) => p.progress < 1 && (p.status.includes("متأخر") || (p.end && p.end < today) || p.progress < p.planned));
  const deadlines = rows.filter((p) => p.end && p.end >= range.from && p.end <= range.to);
  return { range, rows, contract, paid, remaining: contract - paid, average, delayed, deadlines, undated: rows.filter((p) => !p.start && !p.end).length };
}