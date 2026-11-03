import { afterEach, describe, expect, it, vi } from "vitest";
import { notificationPermission, requestNotificationPermission } from "./notification-permission";

afterEach(() => vi.unstubAllGlobals());

describe("notification permission in partially supported browsers", () => {
  it("does not request permission when the method is missing", async () => {
    vi.stubGlobal("window", { Notification: { permission: "default" } });
    expect(notificationPermission()).toBe("unsupported");
    await expect(requestNotificationPermission()).resolves.toBe("unsupported");
  });
  it("handles browsers without notifications", async () => {
    vi.stubGlobal("window", {});
    await expect(requestNotificationPermission()).resolves.toBe("unsupported");
  });
  it("handles a synchronous permission failure", async () => {
    vi.stubGlobal("window", { Notification: { permission: "default", requestPermission: () => { throw new TypeError("unsupported"); } } });
    await expect(requestNotificationPermission()).resolves.toBe("unsupported");
  });
  it("handles a rejected permission request", async () => {
    vi.stubGlobal("window", { Notification: { permission: "default", requestPermission: () => Promise.reject(new Error("blocked")) } });
    await expect(requestNotificationPermission()).resolves.toBe("unsupported");
  });
  it("preserves supported browser permission results", async () => {
    const requestPermission = vi.fn().mockResolvedValue("granted");
    vi.stubGlobal("window", { Notification: { permission: "default", requestPermission } });
    expect(notificationPermission()).toBe("default");
    await expect(requestNotificationPermission()).resolves.toBe("granted");
    expect(requestPermission).toHaveBeenCalledOnce();
  });
});