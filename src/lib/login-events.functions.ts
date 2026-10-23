import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Records a sign-in / sign-out with the caller's IP and approximate location (read server-side, so it can't be faked by the browser). */
export const logLoginEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { event: "login" | "logout"; device: string }) => ({
    event: d.event === "logout" ? "logout" : "login",
    device: String(d.device ?? "").slice(0, 300),
  }))
  .handler(async ({ data, context }) => {
    const ip = (getRequestHeader("cf-connecting-ip") || getRequestHeader("x-forwarded-for")?.split(",")[0] || "").trim();
    let country = getRequestHeader("cf-ipcountry") || "";
    let region = getRequestHeader("cf-region") || "";
    let city = getRequestHeader("cf-ipcity") || "";
    if (ip && !city) {
      try {
        const r = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, { signal: AbortSignal.timeout(3000) });
        const j = (await r.json()) as { success?: boolean; country?: string; region?: string; city?: string };
        if (j.success) { country = j.country || country; region = j.region || ""; city = j.city || ""; }
      } catch { /* location optional */ }
    }
    const claims = context.claims as { email?: string; user_metadata?: { display_name?: string } };
    const user_name = claims.user_metadata?.display_name || (claims.email ?? "").split("@")[0] || "";
    await context.supabase.from("login_events").insert({
      user_id: context.userId, user_name, event: data.event, ip, country, region, city, device: data.device,
    });
    return { ok: true };
  });
