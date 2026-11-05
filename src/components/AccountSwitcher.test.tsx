import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { Session } from "@supabase/supabase-js";

const auth = vi.hoisted(() => ({ refreshSession: vi.fn(), signInWithPassword: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth } }));
vi.mock("@/lib/i18n", () => ({ t: (text: string) => text }));
import { AccountSwitcher } from "./AccountSwitcher";

const owner = { user: { id: "eilaf", email: "eilaf@metalfuze.local", user_metadata: { display_name: "Eilaf" } }, refresh_token: "test-owner" } as Session;
afterEach(() => { cleanup(); localStorage.clear(); vi.resetAllMocks(); });

it("requires Haitham authentication once then switches using his saved session", async () => {
  const haitham = { user: { id: "haitham", email: "haitham@metalfuze.local", user_metadata: { display_name: "هيثم" } }, refresh_token: "test-haitham" } as Session;
  auth.signInWithPassword.mockResolvedValue({ data: { session: haitham }, error: null });
  auth.refreshSession.mockResolvedValue({ data: { session: haitham }, error: null });
  const view = render(<AccountSwitcher session={owner} toEmail={(s) => s} />);
  fireEvent.click(screen.getByRole("button", { name: /تبديل الحساب/ }));
  fireEvent.click(screen.getByRole("button", { name: /هيثم/ }));
  expect(auth.refreshSession).not.toHaveBeenCalled();
  expect(screen.getByPlaceholderText("اسم المستخدم أو البريد الإلكتروني")).toHaveValue("haitham@metalfuze.local");
  fireEvent.change(screen.getByPlaceholderText("كلمة المرور"), { target: { value: "test-only-password" } });
  fireEvent.click(screen.getByRole("button", { name: "إضافة حساب" }));
  await waitFor(() => expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: "haitham@metalfuze.local", password: "test-only-password" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  view.rerender(<AccountSwitcher session={{ ...owner }} toEmail={(s) => s} />);
  fireEvent.click(screen.getByRole("button", { name: /تبديل الحساب/ }));
  fireEvent.click(screen.getByRole("button", { name: /هيثم/ }));
  await waitFor(() => expect(auth.refreshSession).toHaveBeenCalledWith({ refresh_token: "test-haitham" }));
});

it("retains the fixed CEO account after expiry and asks for its password", async () => {
  localStorage.setItem("mf-switch-accounts", JSON.stringify([
    { id: "eilaf", email: owner.user.email, name: "Eilaf", refresh: "test-owner" },
    { id: "ceo", email: "ceo@metalfuze.local", name: "CEO", refresh: "test-expired" },
  ]));
  auth.refreshSession.mockResolvedValue({ data: { session: null }, error: { message: "expired" } });
  render(<AccountSwitcher session={owner} toEmail={(s) => s} />);
  fireEvent.click(screen.getByRole("button", { name: /تبديل الحساب/ }));
  fireEvent.click(screen.getByRole("button", { name: /CEO/ }));
  await waitFor(() => expect(screen.getByPlaceholderText("اسم المستخدم أو البريد الإلكتروني")).toHaveValue("ceo@metalfuze.local"));
  expect(JSON.parse(localStorage.getItem("mf-switch-accounts") ?? "[]")).toContainEqual({ id: "ceo", email: "ceo@metalfuze.local", name: "CEO", refresh: "" });
});