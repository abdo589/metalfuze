import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { projectStore, useProjects, type Project } from "./projects";
import { txnStore, useTransactions, type Txn } from "./transactions";

/** Admins (Eilaf, Abdelrhman) and the CEO share projects/payments through exec_snapshot so every account sees every update live. */
export function ExecSnapshotSync() {
  const [mode, setMode] = useState<"ceo" | "admin" | null>(null);
  useEffect(() => {
    const check = async () => {
      const { data } = await supabase.auth.getUser();
      const u = data.user;
      if (!u) return setMode(null);
      if (u.email === "ceo@metalfuze.local") return setMode("ceo");
      const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", u.id);
      setMode((r ?? []).some((x) => String(x.role) === "admin") ? "admin" : null);
    };
    check();
    const { data: sub } = supabase.auth.onAuthStateChange(() => { check(); });
    return () => sub.subscription.unsubscribe();
  }, []);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!mode) { setReady(false); return; }
    let first = true;
    const pull = async () => {
      const { data } = await supabase.from("exec_snapshot").select("key,data");
      const p = (data?.find((r) => r.key === "projects")?.data as Project[] | undefined) ?? [];
      let t = data?.find((r) => r.key === "transactions")?.data as Txn[] | undefined;
      let nextP = p;
      if (first && mode === "admin") {
        // The shared cloud copy always wins; only add items that exist solely on this device
        // (never the built-in sample data on a fresh device, never older local copies of shared items).
        const hasLocalProjects = localStorage.getItem("metalfuze.projects.v1") !== null;
        if (hasLocalProjects) {
          const ids = new Set(p.map((x) => x.id));
          const names = new Set(p.map((x) => (x.name || "").trim()));
          nextP = [...p, ...projectStore.all().filter((x) => !ids.has(x.id) && !names.has((x.name || "").trim()))];
        }
        if (t) {
          const tids = new Set(t.map((x) => x.id));
          t = [...t, ...txnStore.all().filter((x) => !tids.has(x.id))];
        }
      }
      if (nextP.length && JSON.stringify(nextP) !== JSON.stringify(projectStore.all())) projectStore.replaceAll(nextP);
      if (t && JSON.stringify(t) !== JSON.stringify(txnStore.all())) txnStore.replaceAll(t);
      first = false;
      setReady(true);
    };
    pull();
    const ch = supabase.channel(`sync-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "exec_snapshot" }, () => { pull(); }).subscribe();
    const iv = setInterval(pull, 60000);
    return () => { clearInterval(iv); supabase.removeChannel(ch); };
  }, [mode]);
  const projects = useProjects();
  const txns = useTransactions();
  useEffect(() => {
    if (!mode || !ready) return;
    const h = setTimeout(async () => {
      const { data } = await supabase.from("exec_snapshot").select("key,data");
      const now = new Date().toISOString();
      const rows: { key: string; data: never; updated_at: string }[] = [];
      if (JSON.stringify(data?.find((r) => r.key === "projects")?.data ?? null) !== JSON.stringify(projects)) rows.push({ key: "projects", data: projects as never, updated_at: now });
      if (JSON.stringify(data?.find((r) => r.key === "transactions")?.data ?? null) !== JSON.stringify(txns)) rows.push({ key: "transactions", data: txns as never, updated_at: now });
      if (rows.length) await supabase.from("exec_snapshot").upsert(rows);
    }, 1500);
    return () => clearTimeout(h);
  }, [mode, ready, projects, txns]);
  return null;
}

export function useExecSnapshot() {
  const [state, setState] = useState<{ projects: Project[]; txns: Txn[]; updated: string | null; loading: boolean }>({ projects: [], txns: [], updated: null, loading: true });
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data } = await supabase.from("exec_snapshot").select("key,data,updated_at");
      if (!alive) return;
      const p = data?.find((r) => r.key === "projects");
      const t = data?.find((r) => r.key === "transactions");
      setState({ projects: (p?.data as Project[]) ?? [], txns: (t?.data as Txn[]) ?? [], updated: p?.updated_at ?? null, loading: false });
    };
    load();
    const ch = supabase.channel(`exec-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "exec_snapshot" }, load).subscribe();
    const iv = setInterval(load, 60000);
    return () => { alive = false; clearInterval(iv); supabase.removeChannel(ch); };
  }, []);
  return state;
}

/** Summary figures shown to the executive. */
export function summarize(projects: Project[], txns: Txn[], today = new Date()) {
  const t0 = new Date(today); t0.setHours(0, 0, 0, 0);
  const contract = projects.reduce((a, p) => a + (p.contract || 0), 0);
  const paid = projects.reduce((a, p) => a + (p.paid || 0), 0);
  const avgProgress = projects.length ? projects.reduce((a, p) => a + (p.progress || 0), 0) / projects.length : 0;
  const avgPlanned = projects.length ? projects.reduce((a, p) => a + (p.planned || 0), 0) / projects.length : 0;
  const done = projects.filter((p) => (p.progress || 0) >= 1).length;
  const overdue = projects.filter((p) => p.end && new Date(p.end) < t0 && (p.progress || 0) < 1);
  const behind = projects.filter((p) => (p.progress || 0) < 1 && (p.planned || 0) - (p.progress || 0) >= 0.1);
  const soon = projects.filter((p) => { if (!p.end || (p.progress || 0) >= 1) return false; const d = (new Date(p.end).getTime() - t0.getTime()) / 86400000; return d >= 0 && d <= 30; });
  const month = today.toISOString().slice(0, 7);
  const sum = (l: Txn[], ty: string) => l.filter((x) => x.type === ty).reduce((a, x) => a + x.amount, 0);
  const mt = txns.filter((x) => x.date?.startsWith(month));
  return {
    count: projects.length, done, active: projects.length - done, contract, paid, remaining: Math.max(0, contract - paid),
    collectedPct: contract ? paid / contract : 0, avgProgress, avgPlanned, overdue, behind, soon,
    collected: sum(txns, "collect"), spent: sum(txns, "pay"), balance: sum(txns, "collect") - sum(txns, "pay"),
    monthCollected: sum(mt, "collect"), monthSpent: sum(mt, "pay"),
  };
}
