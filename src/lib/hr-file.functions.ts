import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type HrRow = Record<string, string | number>;
export type HrKey = "employees" | "documents" | "leaves" | "payroll" | "evaluations";

/** One-time import of the uploaded HR workbook into hr_records (only when empty, only by admin/HR). */
export const importHrFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const { count } = await sb.from("hr_records").select("id", { count: "exact", head: true });
    if (count) return { imported: 0 };
    const file = (await import("@/server/hr-file.json")).default as Record<string, { rows: HrRow[] }>;
    const rows = Object.entries(file).flatMap(([sheet, s]) => s.rows.map((data, sort) => ({ sheet, data, sort })));
    const { error } = await sb.from("hr_records").insert(rows);
    if (error) throw new Error("غير مصرح بالاستيراد");
    return { imported: rows.length };
  });
