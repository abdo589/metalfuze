import { describe, expect, it } from "vitest";
import { accountantPaths, isProjectAccountant, pathAllowed } from "./permissions";

describe("Aiftkhar project access", () => {
  it("allows only the named accountant account", () => {
    expect(isProjectAccountant("accountant", "aiftkhar@metalfuze.local")).toBe(true);
    expect(isProjectAccountant("accountant", "another@metalfuze.local")).toBe(false);
    expect(isProjectAccountant("viewer", "aiftkhar@metalfuze.local")).toBe(false);
  });
  it("adds the dashboard and preserves accounting", () => {
    expect(pathAllowed("/", accountantPaths(true))).toBe(true);
    expect(pathAllowed("/accounting", accountantPaths(true))).toBe(true);
    expect(pathAllowed("/", accountantPaths(false))).toBe(false);
  });
  it("dashboard access does not open HR, payments or user administration", () => {
    for (const path of ["/payroll", "/hr-file", "/payments", "/dev", "/users"]) {
      expect(pathAllowed(path, accountantPaths(true))).toBe(false);
    }
  });
});