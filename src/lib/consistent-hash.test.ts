import { describe, expect, it } from "vitest";
import { ConsistentHashRing } from "./consistent-hash";

const keys = Array.from({ length: 2000 }, (_, i) => `req-${i}`);

describe("consistent hashing", () => {
  it("returns the same member for the same key", () => {
    const r = new ConsistentHashRing(["A", "B", "C"]);
    expect(r.get("req-1")).toBe(r.get("req-1"));
  });
  it("adding a 4th member moves only about a quarter of keys", () => {
    const r = new ConsistentHashRing(["A", "B", "C"]);
    const before = keys.map((k) => r.get(k));
    r.add("D");
    const moved = keys.filter((k, i) => r.get(k) !== before[i]);
    expect(moved.length / keys.length).toBeLessThan(0.35);
    expect(moved.every((k) => r.get(k) === "D")).toBe(true);
  });
  it("removing a member only moves that member's keys", () => {
    const r = new ConsistentHashRing(["A", "B", "C"]);
    const before = keys.map((k) => r.get(k));
    r.remove("B");
    keys.forEach((k, i) => { if (before[i] !== "B") expect(r.get(k)).toBe(before[i]); });
  });
  it("empty ring returns null", () => {
    expect(new ConsistentHashRing().get("x")).toBeNull();
  });
});
