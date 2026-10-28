import { useEffect, useState } from "react";
import { projectStore } from "./projects";

export type TxnType = "collect" | "pay";
export type Txn = {
  id: string;
  number: string;
  type: TxnType; // collect = تحصيل من العميل، pay = دفع للمورد
  date: string; // YYYY-MM-DD
  manager: string;
  project: string;
  /** Project id (preferred link; name kept for display and old records). */
  projectId?: string;
  party: string; // العميل أو المورد
  amount: number;
  method: string;
  notes: string;
};

const KEY = "metalfuze.transactions.v1";
const listeners = new Set<() => void>();
let cache: Txn[] | null = null;

function load(): Txn[] {
  if (cache) return cache;
  try { cache = JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { cache = []; }
  return cache!;
}
export const txnChanges = new Set<(changed: Txn[], removed: string[]) => void>();

function save(list: Txn[], fromSync = false) {
  if (!fromSync) {
    const before = new Map((cache ?? load()).map((x) => [x.id, JSON.stringify(x)]));
    const changed = list.filter((x) => before.get(x.id) !== JSON.stringify(x));
    const ids = new Set(list.map((x) => x.id));
    const removed = [...before.keys()].filter((id) => !ids.has(id));
    if (changed.length || removed.length) txnChanges.forEach((f) => f(changed, removed));
  }
  cache = list;
  localStorage.setItem(KEY, JSON.stringify(list));
  listeners.forEach((l) => l());
}

/** Next sequential invoice number per type: REC-0001 for collections, PAY-0001 for payments. */
export function nextNumber(list: Txn[], type: TxnType) {
  const prefix = type === "collect" ? "REC" : "PAY";
  const max = list.filter((x) => x.type === type)
    .reduce((m, x) => Math.max(m, Number(x.number.split("-")[1]) || 0), 0);
  return `${prefix}-${String(max + 1).padStart(4, "0")}`;
}

/** Collected, paid and balance (collected − paid) for a set of transactions. */
export function totals(list: Txn[]) {
  const collected = list.filter((x) => x.type === "collect").reduce((a, x) => a + x.amount, 0);
  const paid = list.filter((x) => x.type === "pay").reduce((a, x) => a + x.amount, 0);
  return { collected, paid, balance: collected - paid };
}

export const txnStore = {
  all: () => load(),
  /** Replace the whole list as-is (used to load the CEO's saved records on any device). */
  replaceAll(list: Txn[]) { save(list); },
  applyRemote(list: Txn[]) { load(); save(list, true); },
  upsert(x: Txn) {
    const list = load();
    const old = list.find((y) => y.id === x.id);
    if (old) syncPaid(old, -1);
    syncPaid(x, 1);
    const i = list.findIndex((y) => y.id === x.id);
    save(i >= 0 ? list.map((y) => (y.id === x.id ? x : y)) : [...list, { ...x, number: x.number || nextNumber(list, x.type) }]);
  },
  remove(id: string) { const old = load().find((x) => x.id === id); if (old) syncPaid(old, -1); save(load().filter((x) => x.id !== id)); },
};

export function useTransactions() {
  const [list, setList] = useState<Txn[]>([]);
  useEffect(() => {
    setList(load());
    const l = () => setList([...load()]);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return list;
}

/** A client collection adds to (or removes from) the project's "paid" amount on the dashboard. */
function syncPaid(x: Txn, sign: 1 | -1) {
  if (x.type !== "collect") return;
  const all = projectStore.all();
  const p = (x.projectId && all.find((q) => q.id === x.projectId)) || all.find((q) => q.name.trim() === x.project.trim());
  if (p) projectStore.upsert({ ...p, paid: Math.max(0, p.paid + sign * x.amount) });
}
