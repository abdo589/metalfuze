import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ uid: undefined as string | undefined, read: vi.fn(), refresh: [] as Array<() => Promise<void>> }));
vi.mock("./auth-session", () => ({ useAuthSession: () => mock.uid ? { user: { id: mock.uid } } : null }));
vi.mock("./live-refresh", () => ({ useLiveRefresh: (_tables: string[], refresh: () => Promise<void>) => { mock.refresh.push(refresh); } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({ select: () => ({ eq: (_key: string, uid: string) => ({ is: () => mock.read(uid) }) }) }) } }));
import { useUnreadMessages } from "./unread-messages";
function Reader({ name }: { name: string }) { return <span data-testid={name}>{useUnreadMessages()}</span>; }
afterEach(() => { cleanup(); mock.uid = undefined; mock.refresh = []; vi.clearAllMocks(); });

it("coalesces simultaneous badge reads and does not fetch signed out", async () => {
  const view = render(<><Reader name="a" /><Reader name="b" /><Reader name="c" /></>);
  expect(mock.read).not.toHaveBeenCalled();
  mock.uid = "user-a";
  mock.read.mockResolvedValue({ count: 7, error: null });
  await act(async () => view.rerender(<><Reader name="a" /><Reader name="b" /><Reader name="c" /></>));
  expect(mock.read).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId("a").textContent).toBe("7");
  expect(screen.getByTestId("c").textContent).toBe("7");
});

it("ignores an old account's in-flight live count after a switch", async () => {
  mock.uid = "old";
  mock.read.mockResolvedValue({ count: 2, error: null });
  const view = render(<Reader name="a" />);
  await act(async () => {});
  let resolveOld: ((r: { count: number; error: null }) => void) | undefined;
  mock.read.mockImplementation((uid) => uid === "old" ? new Promise((resolve) => { resolveOld = resolve; }) : Promise.resolve({ count: 4, error: null }));
  let refresh: Promise<void> | undefined;
  act(() => { refresh = mock.refresh.at(-1)?.(); });
  mock.uid = "new";
  await act(async () => view.rerender(<Reader name="a" />));
  await act(async () => { resolveOld?.({ count: 99, error: null }); await refresh; });
  expect(screen.getByTestId("a").textContent).toBe("4");
});