import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeTxn } from "./bank";
import { assertWritable } from "./write-guard";

type Ctx = { supabase: { rpc: (f: string, a: Record<string, unknown>) => PromiseLike<{ data: unknown }> }; userId: string };

function leanEnv() {
  const appToken = process.env["LEAN_APP_TOKEN"];
  const secret = process.env["LEAN_CLIENT_SECRET"];
  const sandbox = process.env["LEAN_SANDBOX"] === "true";
  const host = sandbox ? "sandbox.leantech.me" : "leantech.me";
  return { appToken, secret, sandbox, api: `https://api.${host}`, auth: `https://auth.${host}/oauth2/token` };
}

async function leanToken(scope: string) {
  const e = leanEnv();
  if (!e.appToken || !e.secret) throw new Error("notconfigured");
  const res = await fetch(e.auth, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: e.appToken, client_secret: e.secret, grant_type: "client_credentials", scope }),
  });
  if (!res.ok) { console.error("Lean auth failed", res.status, await res.text()); throw new Error("bankauth"); }
  return ((await res.json()) as { access_token: string }).access_token;
}

async function lean(path: string, method: "GET" | "POST", body?: unknown) {
  const e = leanEnv();
  const token = await leanToken("api");
  const res = await fetch(`${e.api}${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : null,
  });
  if (!res.ok) { console.error("Lean request failed", path, res.status, await res.text()); throw new Error("bankapi"); }
  return res.json() as Promise<Record<string, unknown>>;
}

async function assertAdmin(ctx: Ctx) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("صلاحية العرض فقط — لا يمكنك التعديل");
}

export const bankStatus = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async () => {
  const e = leanEnv();
  return { configured: !!(e.appToken && e.secret) };
});

/** Starts a connection: creates (or reuses) the Lean customer and returns what the browser SDK needs. */
export const startBankConnect = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await assertAdmin(context as unknown as Ctx);
  await assertWritable(context as never);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let { data: conn } = await supabaseAdmin.from("bank_connections").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!conn) {
    const c = await lean("/customers/v1", "POST", { app_user_id: `metalfuze-${crypto.randomUUID()}` });
    const ins = await supabaseAdmin.from("bank_connections").insert({ customer_id: String(c["customer_id"]) }).select("*").single();
    conn = ins.data!;
  }
  const accessToken = await leanToken(`customer.${conn.customer_id}`);
  const e = leanEnv();
  return { appToken: e.appToken!, customerId: conn.customer_id, accessToken, sandbox: e.sandbox };
});

/** Fetches the latest balance + transactions from the bank and stores a snapshot. */
export const refreshBank = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const ctx = context as unknown as Ctx;
  const { data: staff } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  const { data: viewer } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "viewer" });
  if (!staff && !viewer) throw new Error("forbidden");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: conn } = await supabaseAdmin.from("bank_connections").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!conn) return { ok: false as const, error: "notconnected" };

  let entityId = conn.entity_id;
  if (!entityId) {
    const ents = (await lean(`/customers/v1/${conn.customer_id}/entities`, "GET")) as unknown;
    const list = Array.isArray(ents) ? ents : [];
    entityId = (list[0] as { id?: string } | undefined)?.id ?? null;
    if (!entityId) return { ok: false as const, error: "notconnected" };
    await supabaseAdmin.from("bank_connections").update({ entity_id: entityId, status: "connected", connected_at: new Date().toISOString() }).eq("id", conn.id);
  }

  const accs = await lean("/data/v1/accounts", "POST", { entity_id: entityId });
  const accounts = (((accs["payload"] as { accounts?: unknown[] })?.accounts) ?? []) as Record<string, unknown>[];
  for (const a of accounts) {
    const accountId = String(a["account_id"]);
    const bal = (await lean("/data/v1/balance", "POST", { entity_id: entityId, account_id: accountId }))["payload"] as Record<string, unknown> | undefined;
    const tx = (await lean("/data/v1/transactions", "POST", { entity_id: entityId, account_id: accountId }))["payload"] as { transactions?: Record<string, unknown>[] } | undefined;
    await supabaseAdmin.from("bank_snapshots").insert({
      connection_id: conn.id,
      account_name: String(a["name"] ?? a["account_number"] ?? accountId),
      balance: Number(bal?.["balance"] ?? 0),
      available: bal?.["available_balance"] != null ? Number(bal["available_balance"]) : null,
      currency: String(bal?.["currency_code"] ?? "SAR"),
      transactions: (tx?.transactions ?? []).slice(0, 200).map(normalizeTxn),
    });
  }
  return { ok: true as const };
});

export const disconnectBank = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await assertAdmin(context as unknown as Ctx);
  await assertWritable(context as never);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("bank_connections").delete().neq("customer_id", "");
  return { ok: true };
});
