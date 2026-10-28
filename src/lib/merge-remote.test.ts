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
