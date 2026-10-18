import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_employees",
  title: "List employees",
  description: "List company employees (name, job, department, project, active flag) visible to the signed-in user.",
  inputSchema: {
    search: z.string().max(80).optional().describe("Filter by name (partial match)."),
    activeOnly: z.boolean().optional().describe("Only return active employees."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, activeOnly }, ctx) => {
    const sb = supabaseForUser(ctx);
    let q = sb.from("employees").select("id,name,role,dept,project,active,joined").order("name").limit(200);
    if (search) q = q.ilike("name", `%${search}%`);
    if (activeOnly) q = q.eq("active", true);
    const { data, error } = await q;
    if (error) throw new ToolError(error.message);
    const rows = (data ?? []).map((e) => ({ id: e.id, name: e.name, job: e.role, dept: e.dept, project: e.project, active: e.active, joined: e.joined }));
    return { content: [{ type: "text", text: JSON.stringify(rows) }], structuredContent: { employees: rows } };
  },
});
