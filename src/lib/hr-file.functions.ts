import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type HrSheet = { title: string; columns: string[]; rows: Record<string, string | number>[] };
export type HrFile = Record<"employees" | "documents" | "leaves" | "payroll" | "evaluations", HrSheet>;

/** HR workbook data (contains personal IDs) — served only to admin/HR/viewer staff, never bundled into the browser. */
export const getHrFile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<HrFile> => {
    const { data } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
    const roles = (data ?? []).map((r: { role: string }) => String(r.role));
    if (!roles.some((r: string) => ["admin", "hr", "viewer"].includes(r))) throw new Error("غير مصرح");
    return (await import("@/server/hr-file.json")).default as HrFile;
  });
