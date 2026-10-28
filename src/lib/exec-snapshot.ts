import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { t } from "./i18n";
import { projectStore, projectChanges, type Project } from "./projects";
import { txnStore, txnChanges, type Txn } from "./transactions";

type Row = { id: string; data: unknown; version: number; deleted_at: string | null; updated_at: string };
type Kind = "p" | "t";
/** baseVersion = the shared version this device's edit was made on (undefined = never synced, so insert). */
type Pending = { kind: Kind; id: string; deleted: boolean; baseVersion?: number | undefined };

const VER_KEY = "metalfuze.sync.versions.v1";
const PEND_KEY = "metalfuze.sync.pending.v1";
const CONFLICT_KEY = "metalfuze.sync.conflicts.v1";
const readJson = <T,>(k: string, d: T): T => { try { return JSON.parse(localStorage.getItem(k) || "") as T; } catch { return d; } };

/** Merge the shared rows into this device's list: rows are the truth unless this device has an unsent change for that item. */
export function mergeRemote<T extends { id: string }>(local: T[], rows: Row[], pending: Set<string>): T[] {
  const out = new Map<string, T>();
  for (const r of rows) if (!r.deleted_at) out.set(r.id, r.data as T);
  for (const x of local) if (pending.has(x.id)) out.set(x.id, x);
  for (const r of rows) if (r.deleted_at && !pending.has(r.id)) out.delete(r.id);
  const order = new Map(local.map((x, i) => [x.id, i]));
  return [...out.values()].sort((a, b) => (order.get(a.id) ?? 1e9) - (order.get(b.id) ?? 1e9));
}

/** Admins and the CEO share projects/payments one row per item, with versions so an older device can't overwrite newer edits. */
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

  useEffect(() => {
    if (!mode) return;
    let alive = true;
    let ready = false;
    const versions: Record<string, number> = readJson(VER_KEY, {});
    const pending: Record<string, Pending> = readJson(PEND_KEY, {});
    const persist = () => { localStorage.setItem(VER_KEY, JSON.stringify(versions)); localStorage.setItem(PEND_KEY, JSON.stringify(pending)); };
    const mark = (kind: Kind) => (changed: { id: string }[], removed: string[]) => {
      // Keep the version the first unsent edit was based on; later edits to the same item build on it.
      const base = (key: string) => (pending[key] ? pending[key]!.baseVersion : versions[key]);
      for (const x of changed) { const k = `${kind}:${x.id}`; pending[k] = { kind, id: x.id, deleted: false, baseVersion: base(k) }; }
      for (const id of removed) { const k = `${kind}:${id}`; pending[k] = { kind, id, deleted: true, baseVersion: base(k) }; }
      persist();
      if (ready) schedulePush();
    };
    const onP = mark("p"), onT = mark("t");
    projectChanges.add(onP); txnChanges.add(onT);

    const pull = async () => {
      const [pr, tr] = await Promise.all([
        supabase.from("shared_projects").select("id,data,version,deleted_at,updated_at"),
        supabase.from("shared_txns").select("id,data,version,deleted_at,updated_at"),
      ]);
      if (!alive || pr.error || tr.error) return;
      const prow = (pr.data ?? []) as Row[], trow = (tr.data ?? []) as Row[];
      if (!ready && mode === "admin" && Object.keys(versions).length === 0) {
        // First sync on this device: send items that exist only here (never stale copies of shared names).
        const ids = new Set(prow.map((r) => r.id));
        const names = new Set(prow.map((r) => String((r.data as Project).name ?? "").trim()));
        const hasLocal = localStorage.getItem("metalfuze.projects.v1") !== null;
        if (hasLocal) for (const x of projectStore.all()) if (!ids.has(x.id) && (x.allowSameName || !names.has((x.name || "").trim()))) pending[`p:${x.id}`] = { kind: "p", id: x.id, deleted: false };
        const tids = new Set(trow.map((r) => r.id));
        for (const x of txnStore.all()) if (!tids.has(x.id)) pending[`t:${x.id}`] = { kind: "t", id: x.id, deleted: false };
      }
      // Never move the version under an unsent edit — that is what lets the server reject it if someone else saved first.
      for (const r of prow) if (!pending[`p:${r.id}`]) versions[`p:${r.id}`] = r.version;
      for (const r of trow) if (!pending[`t:${r.id}`]) versions[`t:${r.id}`] = r.version;
      persist();
      const pp = new Set(Object.values(pending).filter((x) => x.kind === "p").map((x) => x.id));
      const tp = new Set(Object.values(pending).filter((x) => x.kind === "t").map((x) => x.id));
      const nextP = uniqByName(mergeRemote(projectStore.all(), prow, pp));
      const nextT = mergeRemote(txnStore.all(), trow, tp);
      if (JSON.stringify(nextP) !== JSON.stringify(projectStore.all())) projectStore.applyRemote(nextP);
      if (JSON.stringify(nextT) !== JSON.stringify(txnStore.all())) txnStore.applyRemote(nextT);
      ready = true;
      if (Object.keys(pending).length) schedulePush();
    };

    let pushing = false;
    const push = async () => {
      if (pushing || !alive) return;
      pushing = true;
      let conflict = false;
      try {
        for (const [key, job] of Object.entries(pending)) {
          const table = job.kind === "p" ? "shared_projects" : "shared_txns";
          const item = job.kind === "p" ? projectStore.all().find((x) => x.id === job.id) : txnStore.all().find((x) => x.id === job.id);
          const v = "baseVersion" in job ? job.baseVersion : versions[key]; // old queues have no baseVersion
          if (!job.deleted && !item) { delete pending[key]; continue; }
          let rows: Row[] | null = null;
          if (v === undefined) {
            if (job.deleted) { delete pending[key]; continue; }
            const r = await supabase.from(table).insert({ id: job.id, data: item as never }).select("id,data,version,deleted_at,updated_at");
            if (r.error && r.error.code !== "23505") throw r.error;
            rows = (r.data as Row[] | null) ?? [];
          } else {
            const patch = job.deleted ? { deleted_at: new Date().toISOString() } : { data: item as never, deleted_at: null };
            const r = await supabase.from(table).update(patch).eq("id", job.id).eq("version", v).select("id,data,version,deleted_at,updated_at");
            if (r.error) throw r.error;
            rows = (r.data as Row[] | null) ?? [];
          }
          const newer = pending[key] !== job; // edited again while this save was in flight
          if (!rows.length) {
            // Someone else saved first: keep this device's copy aside instead of silently losing or forcing it.
            conflict = true;
            if (item) {
              const saved = readJson<unknown[]>(CONFLICT_KEY, []);
              localStorage.setItem(CONFLICT_KEY, JSON.stringify([...saved, { at: new Date().toISOString(), kind: job.kind, item }].slice(-50)));
            }
            delete pending[key]; delete versions[key];
            continue;
          }
          const row = rows[0]!;
          versions[key] = row.version;
          if (newer) pending[key]!.baseVersion = row.version; else delete pending[key];
          if (job.kind === "t" && !row.deleted_at) {
            // The receipt number is assigned by the database.
            const n = (row.data as Txn).number;
            if (n && n !== (item as Txn).number) txnStore.applyRemote(txnStore.all().map((x) => (x.id === job.id ? { ...x, number: n } : x)));
          }
        }
      } catch { /* retried on next change or pull */ }
      finally { persist(); pushing = false; }
      if (conflict) { toast.warning(t("تم تعديل بعض البيانات من جهاز آخر — تم تحميل أحدث نسخة")); await pull(); }
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedulePush = () => { clearTimeout(timer); timer = setTimeout(push, 800); };

    pull();
    const ch = supabase.channel(`sync-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "shared_projects" }, () => { pull(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "shared_txns" }, () => { pull(); })
      .subscribe();
    const iv = setInterval(pull, 60000);
    return () => { alive = false; clearTimeout(timer); clearInterval(iv); supabase.removeChannel(ch); projectChanges.delete(onP); txnChanges.delete(onT); };
  }, [mode]);
  return null;
}

export function useExecSnapshot() {
  const [state, setState] = useState<{ projects: Project[]; txns: Txn[]; updated: string | null; loading: boolean }>({ projects: [], txns: [], updated: null, loading: true });
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [p, t] = await Promise.all([
        supabase.from("shared_projects").select("data,updated_at").is("deleted_at", null),
        supabase.from("shared_txns").select("data,updated_at").is("deleted_at", null),
      ]);
      if (!alive) return;
      const updated = (p.data ?? []).reduce<string | null>((m, r) => (!m || r.updated_at > m ? r.updated_at : m), null);
      setState({ projects: (p.data ?? []).map((r) => r.data as Project), txns: (t.data ?? []).map((r) => r.data as Txn), updated, loading: false });
    };
    load();
    const ch = supabase.channel(`exec-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "shared_projects" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "shared_txns" }, load).subscribe();
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

/** Keeps the first project of each name so stale device copies never return,
 *  except projects the user deliberately saved with a shared name (allowSameName). */
export function uniqByName(list: Project[]) {
  const seen = new Set<string>();
  return list.filter((p) => {
    if (p.allowSameName) return true;
    const k = (p.name || "").trim();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
