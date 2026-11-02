/** Storage keys must be ASCII; the original filename is stored separately for display. */
export type SalesAttachment = { path: string; name: string };

function attachments(value: unknown, path?: string | null, name?: string | null): SalesAttachment[] {
  const files: SalesAttachment[] = Array.isArray(value)
    ? value.filter((f): f is SalesAttachment => !!f && typeof f === "object" && typeof f.path === "string" && typeof f.name === "string")
    : [];
  if (path && !files.some((f) => f.path === path)) {
    return [{ path, name: name || path }, ...files];
  }
  return files;
}

export function pricingAttachments(deal: { pricing_files?: unknown; pricing_file_path?: string | null; pricing_file_name?: string | null }): SalesAttachment[] {
  return attachments(deal.pricing_files, deal.pricing_file_path, deal.pricing_file_name);
}

export function quotationAttachments(deal: { quotation_files?: unknown; quotation_file_path?: string | null; quotation_file_name?: string | null }): SalesAttachment[] {
  return attachments(deal.quotation_files, deal.quotation_file_path, deal.quotation_file_name);
}

export function salesFilePath(userId: string, name: string): string {
  const ext = (name.match(/\.[A-Za-z0-9]+$/)?.[0] ?? "").toLowerCase();
  const base = name.replace(/\.[A-Za-z0-9]+$/, "").replace(/[^\w.\-]/g, "_").slice(0, 60) || "file";
  return `${userId}/${Date.now()}_${crypto.randomUUID()}_${base}${ext}`;
}