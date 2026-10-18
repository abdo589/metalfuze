import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_leave_requests",
  title: "List leave requests",
  description: "List employee leave requests, optionally filtered by status, newest first.",
  inputSchema: {
    status: z.string().max(40).optional().describe("Status filter, e.g. pending_manager, pending_hr, approved, rejected."),
    limit: z.number().int().min(1).max(200).optional().describe("Max rows (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    const sb = supabaseForUser(ctx);
    let q = sb.from("leave_requests")
      .select("request_no,employee_id,type_id,start_date,end_date,working_days,status,reason")
      .order("created_at", { ascending: false }).limit(limit ?? 50);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) throw new ToolError(error.message);
    const rows = (data ?? []).map((r) => ({ ...r }));
    return { content: [{ type: "text", text: JSON.stringify(rows) }], structuredContent: { requests: rows } };
  },
});
