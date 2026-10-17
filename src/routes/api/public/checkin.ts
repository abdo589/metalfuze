import { createFileRoute } from "@tanstack/react-router";
import { recordRemotePunch } from "@/lib/remote-checkin.server";

// Public endpoint for employee self check-in. The caller is identified only by their
// secret personal token; only first name and site name are ever returned.
const json = (b: unknown, status = 200) => Response.json(b, { status, headers: { "Cache-Control": "no-store" } });
const validToken = (t: unknown): t is string => typeof t === "string" && /^[a-f0-9]{24,64}$/.test(t);

async function byToken(token: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("employees").select("id,name,active,site_id").eq("checkin_token", token).maybeSingle();
  if (!data || !data.active) return null;
  let site: string | null = null;
  if (data.site_id) site = (await supabaseAdmin.from("work_sites").select("name").eq("id", data.site_id).maybeSingle()).data?.name ?? null;
  return { ...data, site };
}

export const Route = createFileRoute("/api/public/checkin")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = new URL(request.url).searchParams.get("token");
        if (!validToken(token)) return json({ error: "invalid" }, 404);
        const e = await byToken(token);
        if (!e) return json({ error: "invalid" }, 404);
        return json({ name: e.name, site: e.site });
      },
      POST: async ({ request }) => {
        const raw = await request.text();
        if (raw.length > 3_000_000) return json({ ok: false, error: "photo" }, 413);
        let body: { token?: unknown; action?: unknown; lat?: unknown; lng?: unknown; photo?: unknown };
        try { body = JSON.parse(raw); } catch { return json({ ok: false, error: "bad" }, 400); }
        if (!validToken(body.token) || (body.action !== "in" && body.action !== "out") || typeof body.photo !== "string")
          return json({ ok: false, error: "bad" }, 400);
        const e = await byToken(body.token);
        if (!e) return json({ ok: false, error: "invalid" }, 404);
        const r = await recordRemotePunch({ employeeId: e.id, action: body.action, lat: Number(body.lat), lng: Number(body.lng), photo: body.photo });
        return json(r, r.ok ? 200 : 422);
      },
    },
  },
});
