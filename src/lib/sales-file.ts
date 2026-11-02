/** Storage keys must be ASCII; the original filename is stored separately for display. */
export type SalesAttachment = { path: string; name: string };

export function pricingAttachments(deal: { pricing_files?: unknown; pricing_file_path?: string | null; pricing_file_name?: string | null }): SalesAttachment[] {
  const files: SalesAttachment[] = Array.isArray(deal.pricing_files)
    ? deal.pricing_files.filter((f): f is SalesAttachment => !!f && typeof f === "object" && typeof f.path === "string" && typeof f.name === "string")
    : [];
  if (deal.pricing_file_path && !files.some((f) => f.path === deal.pricing_file_path)) {
    return [{ path: deal.pricing_file_path, name: deal.pricing_file_name || deal.pricing_file_path }, ...files];
  }
  return files;
}

export function salesFilePath(userId: string, name: string): string {
  const ext = (name.match(/\.[A-Za-z0-9]+$/)?.[0] ?? "").toLowerCase();
  const base = name.replace(/\.[A-Za-z0-9]+$/, "").replace(/[^\w.\-]/g, "_").slice(0, 60) || "file";
  return `${userId}/${Date.now()}_${crypto.randomUUID()}_${base}${ext}`;
}