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
};

export const netSalary = (e: Employee) => (e.base || 0) + (e.allowances || 0) - (e.deductions || 0);

export const monthKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, 1).toLocaleDateString(locale(), { month: "long", year: "numeric" });
};

type Row = {
  id: string; name: string; role: string; dept: string; project: string; base: number; allowances: number;
  deductions: number; joined: string | null; active: boolean; paid_months: string[]; device_user_id: string | null;
};
const fromRow = (r: Row): Employee => ({
  id: r.id, name: r.name, role: r.role, dept: r.dept, project: r.project, base: Number(r.base),
  allowances: Number(r.allowances), deductions: Number(r.deductions), joined: r.joined, active: r.active,
  paidMonths: r.paid_months ?? [], deviceUserId: r.device_user_id ?? "",
});
const toRow = (e: Employee): Row => ({
  id: e.id, name: e.name, role: e.role, dept: e.dept, project: e.project, base: e.base, allowances: e.allowances,
  deductions: e.deductions, joined: e.joined || null, active: e.active, paid_months: e.paidMonths,
  device_user_id: e.deviceUserId?.trim() || null,
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
