import { describe, expect, it, vi } from "vitest";
import { assignedAccountRole, createAccountWithRole } from "./account-creation";

describe("account creation role assignment", () => {
  it.each(["person", "person@metalfuze.com", " Person@metalfuze.com "])("assigns the selected role using returned ID for %s", async (username) => {
    const create = vi.fn().mockResolvedValue({ ok: true, id: "new-company-account" });
    const setRole = vi.fn().mockResolvedValue({ ok: true });
    const result = await createAccountWithRole({ name: "Person", username, password: "test-only-unused", role: "manager" }, create, setRole);
    expect(setRole).toHaveBeenCalledWith({ data: { id: "new-company-account", role: "manager" } });
    expect(result.ok).toBe(true);
  });
  it("does not report successful creation when assigning the role fails", async () => {
    const result = await createAccountWithRole(
      { name: "Person", username: "person@metalfuze.com", password: "test-only-unused", role: "viewer" },
      vi.fn().mockResolvedValue({ ok: true, id: "new-company-account" }),
      vi.fn().mockResolvedValue({ ok: false, error: "role write failed" }),
    );
    expect(result.ok).toBe(false);
  });
  it("never assigns a role when account creation fails", async () => {
    const setRole = vi.fn();
    await createAccountWithRole({ name: "Person", username: "person", password: "test-only-unused", role: "viewer" }, vi.fn().mockResolvedValue({ ok: false, error: "duplicate" }), setRole);
    expect(setRole).not.toHaveBeenCalled();
  });
  it("leaves role-less accounts unselected so manager can be explicitly assigned", () => {
    expect(assignedAccountRole([])).toBe("");
    expect(assignedAccountRole(["manager"])).toBe("manager");
    expect(assignedAccountRole(["manager"], true)).toBe("");
    expect(assignedAccountRole(["admin", "developer"])).toBe("developer");
  });
});