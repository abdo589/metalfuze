import { createFileRoute } from "@tanstack/react-router";

// TEMPORARY one-time setup route — removed immediately after use.
const ALLOWED: Record<string, string> = {
  ceo: "CEO",
  haitham: "Eng Haitham",
  eilaf: "Eilaf Alasamri",
  abdelrhman: "Eng Abdelrhman",
};

export const Route = createFileRoute("/api/public/setup-accounts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
        if ((existing?.users.length ?? 0) > 0) return new Response("already set up", { status: 403 });
        const body = (await request.json()) as { accounts: { username: string; password: string }[] };
        const out: string[] = [];
        for (const a of body.accounts) {
          if (!ALLOWED[a.username]) continue;
          const { error } = await supabaseAdmin.auth.admin.createUser({
            email: `${a.username}@metalfuze.local`,
            password: a.password,
            email_confirm: true,
            user_metadata: { display_name: ALLOWED[a.username] },
          });
          out.push(`${a.username}: ${error ? error.message : "ok"}`);
        }
        return Response.json(out);
      },
    },
  },
});
