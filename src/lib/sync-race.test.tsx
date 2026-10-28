import { describe, it, expect, vi } from "vitest";
import { render, act } from "@testing-library/react";

// In-memory stand-in for the two shared tables, with the same version rule as the DB trigger.
const db: any = { shared_projects: new Map(), shared_txns: new Map() };
function q(table: string) {
  const filters: [string, any][] = [];
  let op: any = { kind: "select" };
  const api: any = {
    select() { return api; },
    is() { return api; },
    eq(k: string, v: any) { filters.push([k, v]); return api; },
    insert(row: any) { op = { kind: "insert", row }; return api; },
    update(patch: any) { op = { kind: "update", patch }; return api; },
    then(res: any, rej: any) {
      try {
        const t: any = db[table];
        if (table === "user_roles") return Promise.resolve({ data: [{ role: "admin" }], error: null }).then(res, rej);
        if (op.kind === "select") return Promise.resolve({ data: [...t.values()].map((r) => ({ ...r })), error: null }).then(res, rej);
        if (op.kind === "insert") { const r = { id: op.row.id, data: op.row.data, version: 1, deleted_at: null, updated_at: new Date().toISOString() }; t.set(r.id, r); return Promise.resolve({ data: [{ ...r }], error: null }).then(res, rej); }
        const hits = [...t.values()].filter((r) => filters.every(([k, v]) => r[k] === v));
        for (const r of hits) Object.assign(r, op.patch, { version: r.version + 1 });
        return Promise.resolve({ data: hits.map((r) => ({ ...r })), error: null }).then(res, rej);
      } catch (e) { return Promise.reject(e).then(res, rej); }
    },
  };
  return api;
}
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "u1", email: "admin@metalfuze.local" } } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
    from: (t: string) => q(t),
    channel: () => { const c: any = { on: () => c, subscribe: () => c }; return c; },
    removeChannel: () => {},
  },
}));
vi.mock("sonner", () => ({ toast: { warning: vi.fn(), error: vi.fn(), info: vi.fn() } }));

describe("sync: an offline edit must not overwrite a newer edit from another device", () => {
  it("keeps device B's newer contract value when device A reconnects", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const base = { id: "P1", code: "1", name: "Tower", contract: 1000, paid: 0, progress: 0.1, planned: 0, sector: "", dept: "", manager: "", owner: "", start: null, end: null, status: "", hasContract: "", issues: "", notes: "" };
    // Shared row already at version 3, and this device last saw version 3.
    db.shared_projects.set("P1", { id: "P1", data: { ...base }, version: 3, deleted_at: null, updated_at: "x" });
    localStorage.setItem("metalfuze.projects.v1", JSON.stringify([base]));
    localStorage.setItem("metalfuze.sync.versions.v1", JSON.stringify({ "p:P1": 3 }));
    // Device A edited progress to 50% while offline -> pending.
    localStorage.setItem("metalfuze.projects.v1", JSON.stringify([{ ...base, progress: 0.5 }]));
    localStorage.setItem("metalfuze.sync.pending.v1", JSON.stringify({ "p:P1": { kind: "p", id: "P1", deleted: false } }));
    // Meanwhile device B changed the contract value -> version 4.
    const r = db.shared_projects.get("P1"); r.data = { ...base, contract: 9999 }; r.version = 4;

    const { ExecSnapshotSync } = await import("@/lib/exec-snapshot");
    render(<ExecSnapshotSync />);
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });

    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    const row = db.shared_projects.get("P1");
    // A's stale edit must be rejected as a conflict, so B's value survives.
    expect(row.data.contract).toBe(9999);
  });
});
