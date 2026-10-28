import { describe, it, expect } from "vitest";
import { mergeRemote } from "./exec-snapshot";

const row = (id: string, name: string, deleted = false) => ({ id, data: { id, name }, version: 1, deleted_at: deleted ? "2026-10-28" : null, updated_at: "" });

describe("mergeRemote", () => {
  it("a project deleted on the shared copy does not come back from an old device", () => {
    const out = mergeRemote([{ id: "a", name: "old" }], [row("a", "x", true)], new Set());
    expect(out).toEqual([]);
  });
  it("shared copy wins over an untouched local copy", () => {
    expect(mergeRemote([{ id: "a", name: "old" }], [row("a", "new")], new Set())[0]!.name).toBe("new");
  });
  it("an unsent local edit is kept until it is sent", () => {
    expect(mergeRemote([{ id: "a", name: "mine" }], [row("a", "new")], new Set(["a"]))[0]!.name).toBe("mine");
  });
});

import { createReadCache } from "./read-cache";
describe("read cache", () => {
  it("does not keep a read that started before a write", async () => {
    const c = createReadCache(60_000);
    let release!: () => void;
    const key = "https://x/rest/v1/employees?select=*|";
    const slow = c.get(key, () => new Promise((r) => { release = () => r({ at: 0, status: 200, statusText: "", headers: [], body: new ArrayBuffer(0) }); }));
    c.clearTable("employees");
    release(); await slow;
    expect(c.size()).toBe(0);
  });
});
