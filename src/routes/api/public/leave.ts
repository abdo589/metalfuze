import { createFileRoute } from "@tanstack/react-router";

// Public endpoint for an employee's personal leave link. The caller is identified only by
// their secret token; it returns only that employee's own requests and balance.
const json = (b: unknown, status = 200) => Response.json(b, { status, headers: { "Cache-Control": "no-store" } });
const validToken = (t: unknown): t is string => typeof t === "string" && /^[a-f0-9]{24,64}$/.test(t);
const validDate = (d: unknown): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);
const MAX_FILE = 5 * 1024 * 1024;

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

async function byToken(token: string) {
  const db = await admin();
  const { data } = await db.from("employees").select("id,name,dept,role,active").eq("checkin_token", token).maybeSingle();
  return data && data.active ? data : null;
}

export const Route = createFileRoute("/api/public/leave")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = new URL(request.url).searchParams.get("token");
        if (!validToken(token)) return json({ error: "invalid" }, 404);
        const e = await byToken(token);
        if (!e) return json({ error: "invalid" }, 404);
        const db = await admin();
        const [types, reqs, bal, notes, settings] = await Promise.all([
          db.from("leave_types").select("id,name_ar,name_en,paid,uses_balance,max_days,requires_attachment,calendar_days,active,sort").eq("active", true).order("sort"),
          db.from("leave_requests").select("id,request_no,type_id,start_date,end_date,working_days,return_date,reason,status,manager_note,hr_note,attachment_name,created_at,updated_at").eq("employee_id", e.id).order("start_date", { ascending: false }).limit(50),
          db.rpc("leave_balances"),
          db.from("leave_notifications").select("id,message,created_at").eq("employee_id", e.id).eq("audience", "employee").order("created_at", { ascending: false }).limit(10),
          db.from("leave_settings").select("weekend").eq("id", 1).maybeSingle(),
        ]);
        const balance = (bal.data ?? []).find((b: { employee_id: string }) => b.employee_id === e.id) ?? null;
        return json({
          name: e.name, dept: e.dept, role: e.role, types: types.data ?? [], requests: reqs.data ?? [],
          balance, notifications: notes.data ?? [], weekend: settings.data?.weekend ?? [5, 6],
        });
      },
      POST: async ({ request }) => {
        const raw = await request.text();
        if (raw.length > 8_000_000) return json({ ok: false, error: "file" }, 413);
        let body: Record<string, unknown>;
        try { body = JSON.parse(raw); } catch { return json({ ok: false, error: "bad" }, 400); }
        if (!validToken(body.token)) return json({ ok: false, error: "bad" }, 400);
        const e = await byToken(body.token);
        if (!e) return json({ ok: false, error: "invalid" }, 404);
        const db = await admin();

        if (body.action === "cancel") {
          if (typeof body.id !== "string") return json({ ok: false, error: "bad" }, 400);
          const { error } = await db.rpc("leave_transition", { p_id: body.id, p_action: "cancel", p_emp: e.id, p_note: "ألغاه الموظف" });
          return error ? json({ ok: false, error: error.message }, 422) : json({ ok: true });
        }
        if (body.action !== "create") return json({ ok: false, error: "bad" }, 400);
        if (typeof body.type !== "string" || !validDate(body.start) || !validDate(body.end)) return json({ ok: false, error: "bad" }, 400);
        const reason = typeof body.reason === "string" ? body.reason.slice(0, 1000) : "";

        let path: string | null = null;
        let fileName: string | null = null;
        const f = body.attachment as { name?: unknown; data?: unknown; type?: unknown } | undefined;
        if (f && typeof f.data === "string" && typeof f.name === "string") {
          const bytes = Uint8Array.from(atob(f.data), (c) => c.charCodeAt(0));
          if (bytes.length > MAX_FILE) return json({ ok: false, error: "file" }, 413);
          const ct = typeof f.type === "string" && /^(application\/pdf|image\/(png|jpeg|webp|heic))$/.test(f.type) ? f.type : null;
          if (!ct) return json({ ok: false, error: "filetype" }, 422);
          fileName = f.name.slice(0, 120);
          path = `leave/${e.id}/${crypto.randomUUID()}-${fileName.replace(/[^\w.\-]+/g, "_")}`;
          const up = await db.storage.from("employee-files").upload(path, bytes, { contentType: ct });
          if (up.error) return json({ ok: false, error: "upload" }, 500);
        }
        const { data, error } = await db.rpc("leave_create", {
          p_emp: e.id, p_type: body.type, p_start: body.start, p_end: body.end, p_reason: reason,
          p_attach_path: path ?? undefined, p_attach_name: fileName ?? undefined, p_submit: true,
        });
        if (error) {
          if (path) await db.storage.from("employee-files").remove([path]);
          return json({ ok: false, error: error.message }, 422);
        }
        return json({ ok: true, id: data });
      },
    },
  },
});
