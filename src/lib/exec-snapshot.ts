import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProjects, type Project } from "./projects";
import { useTransactions, type Txn } from "./transactions";
import { useRole } from "./permissions";

/** Admins' browsers publish their current projects/payments so the executive summary (Hisham) stays live. */
export function ExecSnapshotSync() {
  const role = useRole();
  const projects = useProjects();
  const txns = useTransactions();
  useEffect(() => {
    if (role !== "admin") return;
    const h = setTimeout(() => {
      const now = new Date().toISOString();
      supabase.from("exec_snapshot").upsert([
        { key: "projects", data: projects as never, updated_at: now },
        { key: "transactions", data: txns as never, updated_at: now },
      ]).then(() => {});
    }, 1500);
    return () => clearTimeout(h);
  }, [role, projects, txns]);
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
