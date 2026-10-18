import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_manager_projects",
  title: "List manager projects",
  description: "List project-manager projects with client, contract value, paid amount and progress that the signed-in user can see.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_a, ctx) => {
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb.from("mgr_projects")
      .select("id,code,name,client,owner_name,contract,paid,progress,end_date,issues").order("created_at", { ascending: false }).limit(200);
    if (error) throw new ToolError(error.message);
    const rows = (data ?? []).map((p) => ({ ...p }));
    return { content: [{ type: "text", text: JSON.stringify(rows) }], structuredContent: { projects: rows } };
  },
});
