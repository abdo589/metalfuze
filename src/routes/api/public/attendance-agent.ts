import { createFileRoute } from "@tanstack/react-router";
import { filterAgentPunches, tokenMatches } from "@/lib/attendance-agent";

// Office attendance agent endpoint. Public route: the caller is verified by the
// ATTENDANCE_AGENT_TOKEN bearer secret, and the device serial must be admin-approved.
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

export const Route = createFileRoute("/api/public/attendance-agent")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["ATTENDANCE_AGENT_TOKEN"] ?? "";
        const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
        if (!tokenMatches(given, expected)) return json({ error: "unauthorized" }, 401);
        let body: { sn?: unknown; punches?: unknown };
        try { body = JSON.parse((await request.text()).slice(0, 1_000_000)); } catch { return json({ error: "bad json" }, 400); }
        const sn = typeof body.sn === "string" ? body.sn.trim().slice(0, 64) : "";
        if (!sn) return json({ error: "missing sn" }, 400);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: dev } = await supabaseAdmin.from("attendance_devices").select("approved").eq("serial_number", sn).maybeSingle();
        if (!dev?.approved) return json({ error: "device not approved" }, 403);
        const rows = filterAgentPunches(body.punches).map((r) => ({ ...r, device_sn: sn }));
        if (rows.length) {
          const { error } = await supabaseAdmin.from("attendance_logs").upsert(rows, { onConflict: "device_sn,device_user_id,punched_at", ignoreDuplicates: true });
          if (error) { console.error("agent insert failed", error); return json({ error: "store failed" }, 500); }
          await supabaseAdmin.from("attendance_devices").update({ last_seen: new Date().toISOString() }).eq("serial_number", sn);
        }
        return json({ ok: true, stored: rows.length });
      },
    },
  },
});
