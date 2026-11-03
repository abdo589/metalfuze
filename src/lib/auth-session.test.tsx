import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@supabase/supabase-js";

const mock = vi.hoisted(() => ({
  callback: undefined as ((event: string, session: Session | null) => void) | undefined,
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  roles: vi.fn(),
  getUser: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: {
    getUser: mock.getUser,
    onAuthStateChange: (callback: typeof mock.callback) => {
      mock.subscribe(); mock.callback = callback;
      return { data: { subscription: { unsubscribe: mock.unsubscribe } } };
    },
  },
  from: () => ({ select: () => ({ eq: mock.roles }) }),
} }));
import { useAuthSession } from "./auth-session";
import { useRole, useIsAli } from "./permissions";

function Reader({ name }: { name: string }) {
  const session = useAuthSession();
  const role = useRole();
  const ali = useIsAli();
  return <div data-testid={name}>{session?.user.id ?? "none"}:{role ?? "pending"}:{String(ali)}</div>;
}
function session(id: string): Session {
  return { user: { id, email: `${id}@metalfuze.local` } } as Session;
}
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("shared login UI state", () => {
  it("uses one subscription and one role request for simultaneous readers without getUser fan-out", async () => {
    mock.roles.mockResolvedValue({ data: [{ role: "admin" }], error: null });
    render(<><Reader name="a" /><Reader name="b" /><Reader name="c" /></>);
    await act(async () => mock.callback?.("SIGNED_IN", session("eilaf")));
    expect(mock.subscribe).toHaveBeenCalledTimes(1);
    expect(mock.roles).toHaveBeenCalledTimes(1);
    expect(mock.getUser).not.toHaveBeenCalled();
    expect(screen.getByTestId("a").textContent).toBe("eilaf:admin:false");
  });
  it("does not apply an old account's delayed role after switching accounts", async () => {
    let resolveOld: ((value: { data: { role: string }[]; error: null }) => void) | undefined;
    mock.roles.mockImplementation((_, id) => id === "eilaf"
      ? new Promise((resolve) => { resolveOld = resolve; })
      : Promise.resolve({ data: [{ role: "accountant" }], error: null }));
    render(<Reader name="a" />);
    await act(async () => mock.callback?.("SIGNED_IN", session("eilaf")));
    await act(async () => mock.callback?.("SIGNED_IN", session("other")));
    await act(async () => resolveOld?.({ data: [{ role: "admin" }], error: null }));
    expect(screen.getByTestId("a").textContent).toBe("other:accountant:false");
    await act(async () => mock.callback?.("SIGNED_OUT", null));
    expect(screen.getByTestId("a").textContent).toBe("none:pending:false");
  });
});