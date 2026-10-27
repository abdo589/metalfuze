import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { checkAccess } from "@/lib/access-rules";

/** Checks the caller's own sign-in rules against the server clock, real IP and user agent. */
export const checkMyAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("account_access").select("*").eq("user_id", context.userId).maybeSingle();
    if (!data) return { reason: "" };
    const ip = (getRequestHeader("cf-connecting-ip") || getRequestHeader("x-forwarded-for")?.split(",")[0] || "").trim();
    return { reason: checkAccess(data, { now: new Date(), ip, ua: getRequestHeader("user-agent") || "" }) };
  });
