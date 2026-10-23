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
    let risk = { suspicious: false, reason: "" };
    if (data.event === "login") {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: prev } = await supabaseAdmin.from("login_events").select("country,device")
          .eq("user_id", context.userId).eq("event", "login").order("created_at", { ascending: false }).limit(50);
        const { assessLogin, deviceLabel } = await import("@/lib/login-risk");
        risk = assessLogin(prev ?? [], { country, device: data.device });
        if (risk.suspicious) {
          const { data: devs } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "developer");
          const when = new Date().toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" });
          const body = `⚠️ دخول مريب (${risk.reason})\nالحساب: ${user_name}\nالمنطقة: ${[city, region, country].filter(Boolean).join("، ") || "—"}\nIP: ${ip || "—"}\nالجهاز: ${deviceLabel(data.device)}\nالوقت: ${when}`;
          const rows = (devs ?? []).filter((d) => d.user_id !== context.userId)
            .map((d) => ({ sender_id: context.userId, recipient_id: d.user_id, body }));
          if (rows.length) await supabaseAdmin.from("direct_messages").insert(rows);
        }
      } catch { /* alert optional */ }
    }
    await context.supabase.from("login_events").insert({
      user_id: context.userId, user_name, event: data.event, ip, country, region, city, device: data.device, ...risk,
    });
    return { ok: true };
  });
