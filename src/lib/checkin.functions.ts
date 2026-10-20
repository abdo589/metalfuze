import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { recordRemotePunch } from "./remote-checkin.server";

/** Supervisor records arrival/leaving for a worker (admins only). */
export const supervisorCheckin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    employeeId: z.string().min(1).max(100), action: z.enum(["in", "out"]),
    lat: z.number(), lng: z.number(), photo: z.string().max(3_000_000),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    const { data: isHr } = await context.supabase.rpc("is_hr", { _user_id: context.userId });
    if (!isAdmin && !isHr) return { ok: false as const, error: "forbidden" };
    return recordRemotePunch(data);
  });

/** HR/admin manually marks an employee present (in) or leaving (out) at a chosen time. */
export const manualPunch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    employeeId: z.string().min(1).max(100), action: z.enum(["in", "out"]),
    at: z.string().datetime({ offset: true }),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    const { data: isHr } = await context.supabase.rpc("is_hr", { _user_id: context.userId });
    if (!isAdmin && !isHr) return { ok: false as const, error: "forbidden" };
    const at = new Date(data.at);
    if (at.getTime() > Date.now() + 5 * 60_000) return { ok: false as const, error: "future" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: emp } = await supabaseAdmin.from("employees").select("id,device_user_id,active").eq("id", data.employeeId).maybeSingle();
    if (!emp || !emp.active) return { ok: false as const, error: "employee" };
    const { error } = await supabaseAdmin.from("attendance_logs").insert({
      device_sn: "MANUAL", device_user_id: emp.device_user_id || emp.id, punched_at: at.toISOString(),
      status: data.action === "in" ? 0 : 1, source: "manual",
    });
    if (error) return { ok: false as const, error: "save" };
    return { ok: true as const };
  });

/** HR/admin removes a manually entered punch (device punches stay untouched). */
export const deleteManualPunch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ deviceUserId: z.string().min(1).max(100), at: z.string().min(10).max(40) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    const { data: isHr } = await context.supabase.rpc("is_hr", { _user_id: context.userId });
    if (!isAdmin && !isHr) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("attendance_logs").delete()
      .eq("device_sn", "MANUAL").eq("device_user_id", data.deviceUserId).eq("punched_at", data.at);
    return { ok: !error };
  });
