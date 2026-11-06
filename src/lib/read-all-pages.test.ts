import { describe, expect, it, vi } from "vitest";
import { readAllPages } from "./read-all-pages";

describe("complete paginated reads", () => {
  it("retains every row across pages and requests inclusive nonoverlapping ranges", async () => {
    const source = Array.from({ length: 1201 }, (_, id) => ({ id }));
    const read = vi.fn(async (from: number, to: number) => ({ data: source.slice(from, to + 1), error: null }));
    expect(await readAllPages(read)).toEqual(source);
    expect(read.mock.calls).toEqual([[0, 499], [500, 999], [1000, 1499]]);
  });
  it("does not publish partial totals when a later page fails", async () => {
    const error = new Error("offline");
    await expect(readAllPages(async (from) => from === 0 ? { data: [1, 2], error: null } : { data: null, error }, 2)).rejects.toBe(error);
  });
  it("terminates after an empty page when the row count is an exact multiple", async () => {
    const read = vi.fn(async (from: number) => ({ data: from === 0 ? [1, 2] : [], error: null }));
    expect(await readAllPages(read, 2)).toEqual([1, 2]);
    expect(read).toHaveBeenCalledTimes(2);
  });
});