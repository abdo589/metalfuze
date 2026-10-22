import { describe, expect, it } from "vitest";
import { createReadCache } from "./read-cache";

const entry = (status = 200) => ({ at: 0, status, statusText: "", headers: [] as [string, string][], body: new ArrayBuffer(0) });

describe("read cache", () => {
  it("shares concurrent identical reads", async () => {
    const c = createReadCache(15_000, () => 0); let calls = 0;
    const load = async () => { calls++; return entry(); };
    await Promise.all([c.get("a", load), c.get("a", load)]);
    expect(calls).toBe(1);
  });
  it("refetches after 15 seconds", async () => {
    let t = 0; const c = createReadCache(15_000, () => t); let calls = 0;
    const load = async () => { calls++; return { ...entry(), at: t }; };
    await c.get("a", load); t = 14_999; await c.get("a", load); expect(calls).toBe(1);
    t = 15_000; await c.get("a", load); expect(calls).toBe(2);
  });
  it("a write clears that table only", async () => {
    const c = createReadCache(15_000, () => 0);
    await c.get("https://x/rest/v1/employees?select=*|t", async () => entry());
    await c.get("https://x/rest/v1/leave?select=*|t", async () => entry());
    c.clearTable("employees");
    expect(c.size()).toBe(1);
  });
  it("does not keep failed reads", async () => {
    const c = createReadCache(15_000, () => 0);
    await c.get("a", async () => entry(500));
    expect(c.size()).toBe(0);
  });
});
