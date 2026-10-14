import { useEffect, useState } from "react";

export type Employee = {
  id: string;
  name: string;
  role: string;
  dept: string;
  project: string;
  base: number; // الراتب الأساسي
  allowances: number; // البدلات
  deductions: number; // الخصومات
  joined: string | null; // تاريخ التعيين
  active: boolean;
  paidMonths: string[]; // أشهر مدفوعة بصيغة YYYY-MM
};

export const netSalary = (e: Employee) => (e.base || 0) + (e.allowances || 0) - (e.deductions || 0);

export const monthKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, 1).toLocaleDateString("ar-SA-u-ca-gregory", { month: "long", year: "numeric" });
};

const seed: Employee[] = [
  { id: "e1", name: "م. أحمد الشهري", role: "مدير مشاريع", dept: "إدارة المشاريع", project: "برج المكاتب الإداري", base: 22000, allowances: 3000, deductions: 0, joined: "2021-03-01", active: true, paidMonths: [] },
  { id: "e2", name: "م. سارة العتيبي", role: "مهندسة موقع", dept: "الهندسة", project: "مجمع سكني — الرياض", base: 14500, allowances: 1500, deductions: 0, joined: "2022-06-15", active: true, paidMonths: [] },
  { id: "e3", name: "خالد المطيري", role: "محاسب مشاريع", dept: "المالية", project: "", base: 11000, allowances: 800, deductions: 500, joined: "2020-01-10", active: true, paidMonths: [] },
  { id: "e4", name: "م. فهد القحطاني", role: "مهندس تنفيذ", dept: "الهندسة", project: "فندق الواجهة البحرية", base: 13500, allowances: 1200, deductions: 0, joined: "2023-02-01", active: true, paidMonths: [] },
  { id: "e5", name: "نورة الدوسري", role: "مسؤولة موارد بشرية", dept: "الموارد البشرية", project: "", base: 10500, allowances: 700, deductions: 0, joined: "2022-09-01", active: true, paidMonths: [] },
  { id: "e6", name: "م. عبدالله الغامدي", role: "مساح", dept: "الهندسة", project: "مركز تجاري — جدة", base: 9000, allowances: 600, deductions: 0, joined: "2023-11-20", active: true, paidMonths: [] },
  { id: "e7", name: "ريم الحربي", role: "منسقة عقود", dept: "العقود", project: "", base: 8500, allowances: 500, deductions: 0, joined: "2024-01-05", active: true, paidMonths: [] },
  { id: "e8", name: "م. تركي العنزي", role: "مشرف سلامة", dept: "السلامة والجودة", project: "برج المكاتب الإداري", base: 9500, allowances: 900, deductions: 200, joined: "2021-08-12", active: true, paidMonths: [] },
];

const KEY = "metalfuze.payroll.v1";
const listeners = new Set<() => void>();
let cache: Employee[] | null = null;

function load(): Employee[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? JSON.parse(raw) : seed;
  } catch {
    cache = seed;
  }
  return cache!;
}

function save(list: Employee[]) {
  cache = list;
  localStorage.setItem(KEY, JSON.stringify(list));
  listeners.forEach((l) => l());
}

export const payrollStore = {
  all: () => load(),
  upsert(e: Employee) {
    const list = load();
    const i = list.findIndex((x) => x.id === e.id);
    save(i >= 0 ? list.map((x) => (x.id === e.id ? e : x)) : [...list, e]);
  },
  remove(id: string) {
    save(load().filter((x) => x.id !== id));
  },
  togglePaid(id: string, month: string) {
    const list = load();
    save(
      list.map((x) =>
        x.id === id
          ? { ...x, paidMonths: x.paidMonths.includes(month) ? x.paidMonths.filter((m) => m !== month) : [...x.paidMonths, month] }
          : x,
      ),
    );
  },
  payAll(month: string) {
    save(load().map((x) => (x.active && !x.paidMonths.includes(month) ? { ...x, paidMonths: [...x.paidMonths, month] } : x)));
  },
  reset() {
    save(seed);
  },
};

export function usePayroll() {
  const [list, setList] = useState<Employee[]>(seed);
  useEffect(() => {
    setList(load());
    const l = () => setList([...load()]);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return list;
}

export function newEmpId() {
  return "e" + Math.random().toString(36).slice(2, 10);
}
