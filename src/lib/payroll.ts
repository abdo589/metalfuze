import { locale } from "./i18n";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type Employee = {
  id: string;
  name: string;
  role: string;
  dept: string;
  project: string;
  base: number;
  allowances: number;
  deductions: number;
  joined: string | null;
  active: boolean;
  paidMonths: string[];
  deviceUserId?: string; // رقم الموظف في جهاز البصمة
  siteId?: string | null; // موقع العمل للحضور عن بعد (يُدار من صفحة الحضور)
  checkinToken?: string | null;
  email?: string; // يربط حساب الموظف بملفه تلقائيًا
  monthly?: Record<string, MonthPay>; // رواتب مختلفة لكل شهر (YYYY-MM)
};
export type MonthPay = { base: number; allowances: number; deductions: number };

/** Salary figures for a month: that month's entry, else the latest earlier entry, else the defaults. */
export function forMonth(e: Employee, month: string): Employee {
  const keys = Object.keys(e.monthly ?? {}).filter((k) => k <= month).sort();
  const k = keys[keys.length - 1];
  return k ? { ...e, ...e.monthly![k] } : e;
}

export const netSalary = (e: Employee) => (e.base || 0) + (e.allowances || 0) - (e.deductions || 0);

export const monthKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, 1).toLocaleDateString(locale(), { month: "long", year: "numeric" });
};

const addMonths = (key: string, delta: number) => {
  const [y, m] = key.split("-").map(Number);
  return monthKey(new Date(y!, (m ?? 1) - 1 + delta, 1));
};

/**
 * Months offered in the payroll picker, generated from the data:
 * it reaches back to the earliest joined date, salary record or paid month,
 * and always covers at least the last 12 months up to the current month.
 */
export function availableMonths(employees: Employee[], today = new Date()): string[] {
  const cur = monthKey(today);
  let start = addMonths(cur, -11);
  for (const e of employees) {
    const candidates = [
      e.joined ? String(e.joined).slice(0, 7) : "",
      ...Object.keys(e.monthly ?? {}),
      ...(e.paidMonths ?? []),
    ].filter((k) => /^\d{4}-\d{2}$/.test(k));
    for (const k of candidates) if (k < start) start = k;
  }
  const list: string[] = [];
  for (let k = start; k <= cur; k = addMonths(k, 1)) list.push(k);
  return list;
}

type Row = {
  id: string; name: string; role: string; dept: string; project: string; base: number; allowances: number;
  deductions: number; joined: string | null; active: boolean; paid_months: string[]; device_user_id: string | null;
  site_id?: string | null; checkin_token?: string | null; email?: string | null; monthly?: Record<string, MonthPay> | null;
};
const fromRow = (r: Row): Employee => ({
  id: r.id, name: r.name, role: r.role, dept: r.dept, project: r.project, base: Number(r.base),
  allowances: Number(r.allowances), deductions: Number(r.deductions), joined: r.joined, active: r.active,
  paidMonths: r.paid_months ?? [], deviceUserId: r.device_user_id ?? "", siteId: r.site_id ?? null, checkinToken: r.checkin_token ?? null, email: r.email ?? "", monthly: r.monthly ?? {},
});
const toRow = (e: Employee): Row => ({
  id: e.id, name: e.name, role: e.role, dept: e.dept, project: e.project, base: e.base, allowances: e.allowances,
  deductions: e.deductions, joined: e.joined || null, active: e.active, paid_months: e.paidMonths,
  device_user_id: e.deviceUserId?.trim() || null,
  email: e.email?.trim().toLowerCase() || null,
  monthly: e.monthly ?? {},
});

const listeners = new Set<() => void>();
let cache: Employee[] = [];
let loading: Promise<void> | null = null;

function emit() { listeners.forEach((l) => l()); }

async function refresh() {
  const { data, error } = await supabase.from("employees").select("*").order("created_at");
  if (error) { console.error(error); return; }
  cache = (data as Row[]).map(fromRow);
  emit();
}

async function write(p: PromiseLike<{ error: { message: string } | null }>) {
  const { error } = await p;
  if (error) toast.error(error.message);
  await refresh();
}

export const payrollStore = {
  all: () => cache,
  refresh,
  upsert(e: Employee) {
    cache = cache.some((x) => x.id === e.id) ? cache.map((x) => (x.id === e.id ? e : x)) : [...cache, e];
    emit();
    return write(supabase.from("employees").upsert(toRow(e)));
  },
  remove(id: string) {
    cache = cache.filter((x) => x.id !== id); emit();
    return write(supabase.from("employees").delete().eq("id", id));
  },
  clearAll() {
    cache = []; emit();
    return write(supabase.from("employees").delete().neq("id", ""));
  },
  togglePaid(id: string, month: string) {
    const e = cache.find((x) => x.id === id);
    if (!e) return;
    const paidMonths = e.paidMonths.includes(month) ? e.paidMonths.filter((m) => m !== month) : [...e.paidMonths, month];
    return payrollStore.upsert({ ...e, paidMonths });
  },
  async payAll(month: string) {
    const list = cache.filter((x) => x.active && !x.paidMonths.includes(month)).map((x) => ({ ...x, paidMonths: [...x.paidMonths, month] }));
    if (!list.length) return;
    cache = cache.map((x) => list.find((y) => y.id === x.id) ?? x); emit();
    return write(supabase.from("employees").upsert(list.map(toRow)));
  },
};

export function usePayroll() {
  const [list, setList] = useState<Employee[]>(cache);
  useEffect(() => {
    const l = () => setList([...cache]);
    listeners.add(l);
    if (!loading) loading = refresh();
    else l();
    return () => { listeners.delete(l); };
  }, []);
  return list;
}

export function newEmpId() {
  return "e" + Math.random().toString(36).slice(2, 10);
}

/** Cumulative payout for one employee, from the joined month (or first data month) to the current month. */
export function payoutTotals(e: Employee, today = new Date()) {
  let paid = 0, remaining = 0;
  for (const m of availableMonths([e], today)) {
    if (e.joined && m < String(e.joined).slice(0, 7)) continue;
    const net = netSalary(forMonth(e, m));
    if (e.paidMonths.includes(m)) paid += net; else if (e.active) remaining += net;
  }
  return { paid, remaining };
}
