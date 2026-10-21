import { useEffect, useState } from "react";
import { t } from "./i18n";
import seed from "./seed.json";

export type Project = {
  id: string;
  code: string;
  name: string;
  sector: string;
  dept: string;
  manager: string;
  owner: string;
  start: string | null;
  end: string | null;
  actualEnd?: string | null;
  status: string;
  progress: number; // 0..1
  planned: number; // 0..1
  contract: number;
  paid: number;
  hasContract: string;
  issues: string;
  notes: string;
};

const KEY = "metalfuze.projects.v1";
const listeners = new Set<() => void>();
let cache: Project[] | null = null;

function load(): Project[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = (raw ? JSON.parse(raw) : (seed as Project[])).map(withAutoStatus);
  } catch {
    cache = (seed as Project[]).map(withAutoStatus);
  }
  return cache!;
}

function save(list: Project[]) {
  list = list.map(withAutoStatus);
  cache = list;
  localStorage.setItem(KEY, JSON.stringify(list));
  listeners.forEach((l) => l());
}

export const projectStore = {
  all: () => load(),
  upsert(p: Project) {
    const list = load();
    const i = list.findIndex((x) => x.id === p.id);
    save(i >= 0 ? list.map((x) => (x.id === p.id ? p : x)) : [...list, p]);
  },
  remove(id: string) {
    save(load().filter((x) => x.id !== id));
  },
  replaceAll(list: Project[]) {
    save(list);
  },
  reset() {
    save(seed as Project[]);
  },
};

export function useProjects() {
  const [list, setList] = useState<Project[]>(seed as Project[]);
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

export function daysLeft(end: string | null) {
  if (!end) return null;
  const d = new Date(end).getTime() - new Date().setHours(0, 0, 0, 0);
  return Math.ceil(d / 86400000);
}

export function deadlineAlert(end: string | null) {
  const d = daysLeft(end);
  if (d === null) return "";
  if (d < 0) return t("انتهى");
  if (d <= 30) return t("متبقي أقل من شهر");
  return t("ساري");
}

export const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n || 0);
export const fmtPct = (n: number) => `${Math.round((n || 0) * 100)}%`;

/** Status follows the dates: finished early/on time/late, or running on time/late. */
export function autoStatus(p: Pick<Project, "start" | "end" | "actualEnd" | "status">, today = new Date().toISOString().slice(0, 10)): string {
  if (!p.end) return p.status;
  if (p.actualEnd) {
    const r = p.actualEnd < p.end ? "متقدم" : p.actualEnd > p.end ? "متأخر" : "طبيعي";
    return `منتهي - ${r}`;
  }
  return today > p.end ? "متأخر" : "طبيعي";
}
export const withAutoStatus = (p: Project): Project => ({ ...p, status: autoStatus(p) });

export const STATUSES = ["طبيعي", "متقدم", "متأخر"];
export const STATUS_OPTIONS = ["طبيعي", "متأخر", "متقدم", "منتهي - طبيعي", "منتهي - متقدم", "منتهي - متأخر"];
export const SECTORS = ["سكني", "تجاري", "مكتبي", "فندقي", "خاص", "خدمات", "صحي", "مطاعم", "فندقي + سكني"];

export function newId() {
  return Math.random().toString(36).slice(2, 10);
}

/** Parse an uploaded follow-up workbook (same layout as the original Excel). */
export async function importExcel(file: File): Promise<Project[]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]!]!;
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });
  const h = rows.findIndex((r) => r.some((c) => String(c ?? "").trim() === "اسم المشروع"));
  if (h < 0) throw new Error(t("لم يتم العثور على عمود اسم المشروع"));
  const head = rows[h]!.map((c) => String(c ?? "").trim());
  const col = (n: string) => head.indexOf(n);
  const str = (v: unknown) => (v == null ? "" : String(v).trim());
  const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);
  const date = (v: unknown) =>
    v instanceof Date ? v.toISOString().slice(0, 10) : v ? String(v).slice(0, 10) : null;
  return rows
    .slice(h + 1)
    .filter((r) => str(r[col("اسم المشروع")]))
    .map((r) => ({
      id: newId(),
      code: str(r[col("رمز المشروع")]),
      name: str(r[col("اسم المشروع")]),
      sector: str(r[col("القطاع")]),
      dept: str(r[col("الإدارة")]),
      manager: str(r[col("مدير المشروع")]),
      owner: str(r[col("مالك المشروع")]),
      start: date(r[col("تاريخ بداية المشروع")]),
      end: date(r[col("تاريخ انتهاء المشروع")]),
      status: str(r[col("حالة المشروع")]),
      progress: num(r[col("نسبة الإنجاز")]),
      planned: num(r[col("نسبة الإنجاز المخطط")]),
      contract: num(r[col("قيمة العقد")]),
      paid: num(r[col("المدفوع")]),
      hasContract: str(r[col("هل يوجد عقد شركة")]),
      issues: str(r[col("الإشكاليات / العوائق")]),
      notes: str(r[col("ملاحظات مهمة")]),
    }));
}
