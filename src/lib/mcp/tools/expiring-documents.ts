import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_expiring_documents",
  title: "List expiring documents",
  description: "List residency (iqama), work permit, insurance and contract dates expiring within the given number of days (including already expired).",
  inputSchema: { withinDays: z.number().int().min(1).max(365).optional().describe("Window in days (default 60).") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ withinDays }, ctx) => {
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb.from("residencies")
      .select("name,nationality,job,iqama_expiry,permit_expiry,insurance_expiry,contract_expiry").limit(500);
    if (error) throw new ToolError(error.message);
    const limitMs = Date.now() + (withinDays ?? 60) * 86400000;
    const items: { name: string; document: string; expiry: string; daysLeft: number }[] = [];
    for (const r of data ?? []) {
      for (const [doc, d] of [["iqama", r.iqama_expiry], ["work_permit", r.permit_expiry], ["insurance", r.insurance_expiry], ["contract", r.contract_expiry]] as const) {
        if (!d) continue;
        const t = new Date(d).getTime();
        if (t <= limitMs) items.push({ name: r.name, document: doc, expiry: d, daysLeft: Math.ceil((t - Date.now()) / 86400000) });
      }
    }
    items.sort((a, b) => a.daysLeft - b.daysLeft);
    return { content: [{ type: "text", text: JSON.stringify(items) }], structuredContent: { items } };
  },
});
