/** Fetch complete ordered read results without treating a server page cap as the total. */
export async function readAllPages<T>(
  read: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize = 500,
): Promise<T[]> {
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new Error("Invalid page size");
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const result = await read(from, from + pageSize - 1);
    if (result.error) throw result.error;
    if (!result.data) throw new Error("Missing read result");
    rows.push(...result.data);
    if (result.data.length < pageSize) return rows;
  }
}