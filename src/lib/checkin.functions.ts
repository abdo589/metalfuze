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
