import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertWritable } from "./write-guard";

/** HR/admin emails the employee the details of a device handed over to them. */
export const emailCustodyHandover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    assetId: z.string().uuid(),
    email: z.string().trim().email().max(200).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    const { data: isHr } = await context.supabase.rpc("is_hr", { _user_id: context.userId });
    if (!isAdmin && !isHr) return { ok: false as const, error: "forbidden" };
    await assertWritable(context);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: asset } = await db.from("custody_assets").select("*").eq("id", data.assetId).maybeSingle();
    if (!asset || asset.status !== "مسلم" || !asset.employee_name) return { ok: false as const, error: "asset" };
    let to = data.email?.toLowerCase() ?? null;
    if (!to && asset.employee_no) {
      const { data: e } = await db.from("employees").select("email").eq("id", asset.employee_no).maybeSingle();
      to = e?.email || null;
      if (!to) {
        const { data: p } = await db.from("profiles").select("email").eq("employee_id", asset.employee_no).maybeSingle();
        to = p?.email || null;
      }
    }
    if (!to) return { ok: false as const, error: "no_email" };
    if (data.email && asset.employee_no) await db.from("employees").update({ email: to }).eq("id", asset.employee_no);
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    try {
      const r = await sendTemplateEmail("custody-handover", to, {
        templateData: {
          employee: asset.employee_name, device: asset.name, brand: asset.brand, model: asset.model,
          serial: asset.serial_no, assetNo: asset.asset_no, specs: asset.specs, dept: asset.dept, date: asset.handover_date,
        },
        idempotencyKey: `custody-${asset.id}-${Date.now()}`,
      });
      if (!r.sent) return { ok: false as const, error: "suppressed" };
    } catch (e: unknown) {
      console.error("custody handover email failed", e);
      return { ok: false as const, error: (e as { code?: string })?.code === "domain_not_verified" ? "domain" : "send" };
    }
    return { ok: true as const };
  });
