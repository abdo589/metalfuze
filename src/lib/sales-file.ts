/** Storage keys must be ASCII; the original filename is stored separately for display. */
export function salesFilePath(userId: string, name: string): string {
  const ext = (name.match(/\.[A-Za-z0-9]+$/)?.[0] ?? "").toLowerCase();
  const base = name.replace(/\.[A-Za-z0-9]+$/, "").replace(/[^\w.\-]/g, "_").slice(0, 60) || "file";
  return `${userId}/${Date.now()}_${crypto.randomUUID()}_${base}${ext}`;
}