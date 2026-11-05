import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (options: unknown) => options }));
vi.mock("@/components/ThemeToggle", () => ({ ThemeToggle: () => null }));
vi.mock("@/components/ProjectDetails", () => ({ ProjectDetails: () => null }));
vi.mock("@/components/ExecCharts", () => ({ ExecCharts: () => null }));
vi.mock("@/lib/exec-snapshot", () => ({
  useExecSnapshot: () => ({ projects: [], txns: [], updated: null, loading: false }),
  summarize: () => ({ count: 0, active: 0, done: 0, avgProgress: 0, avgPlanned: 0, collectedPct: 0, remaining: 0, overdue: [], behind: [], soon: [], contract: 0, paid: 0, collected: 0, spent: 0, balance: 0, monthCollected: 24000, monthSpent: 0 }),
}));
vi.mock("@/lib/projects", () => ({ fmtMoney: (n: number) => String(n), fmtPct: (n: number) => `${n * 100}%` }));
vi.mock("@/lib/advances", () => ({ useAdjustments: () => new Map([["najla", { advances: 4763, commissions: 0 }]]) }));
vi.mock("@/lib/payroll", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/payroll")>(),
  usePayroll: () => [{ id: "najla", name: "Najla", base: 12000, allowances: 0, deductions: 0, active: true, paidMonths: [] }],
}));
import { Route } from "./executive";
afterEach(cleanup);

describe("executive salary costs", () => {
  it("keeps Najla's 4763 separate from the 12000 salary and 50% collection ratio", () => {
    const page = Route as unknown as { component: React.ComponentType };
    render(<page.component />);
    const salary = screen.getByText("صافي الرواتب").parentElement;
    expect(salary?.textContent).toContain("12000");
    expect(salary?.textContent).not.toContain("7237");
    expect(screen.getByText(/تكلفة الرواتب هذا الشهر/).textContent).toContain("12000، تعادل 50%");
    const advances = screen.getByText("سلف ومخالفات منفصلة").parentElement;
    expect(advances?.textContent).toContain("4763");
  });
});