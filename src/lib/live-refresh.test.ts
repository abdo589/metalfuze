import { describe, expect, it, vi } from "vitest";
import { refreshLiveReaders, subscribeLiveRefresh } from "./live-refresh";

describe("live data readers", () => {
  it("refreshes only the changed section", async () => {
    const payroll = vi.fn(), meetings = vi.fn();
    const a = subscribeLiveRefresh(["employees"], payroll);
    const b = subscribeLiveRefresh(["sales_meetings"], meetings);
    refreshLiveReaders("employees");
    expect(payroll).toHaveBeenCalledTimes(1);
    expect(meetings).not.toHaveBeenCalled();
    a(); b();
  });
  it("refreshes all mounted sections without needing navigation", () => {
    const a = vi.fn(), b = vi.fn();
    const stopA = subscribeLiveRefresh(["hr_records"], a);
    const stopB = subscribeLiveRefresh(["projects"], b);
    refreshLiveReaders();
    expect(a).toHaveBeenCalledTimes(1); expect(b).toHaveBeenCalledTimes(1);
    stopA(); stopB();
  });
  it("stops refreshing a section after unmount", () => {
    const load = vi.fn(); const stop = subscribeLiveRefresh(["employees"], load);
    stop(); refreshLiveReaders("employees"); expect(load).not.toHaveBeenCalled();
  });
  it("coalesces bursts without concurrent loads", async () => {
    let finish: (() => void) | undefined;
    const load = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const stop = subscribeLiveRefresh(["employees"], load);
    refreshLiveReaders("employees"); refreshLiveReaders("employees"); refreshLiveReaders("employees");
    expect(load).toHaveBeenCalledTimes(1);
    finish?.(); await Promise.resolve(); await Promise.resolve();
    expect(load).toHaveBeenCalledTimes(2);
    stop(); finish?.();
  });
});