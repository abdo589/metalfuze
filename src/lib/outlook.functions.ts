import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GW = "https://connector-gateway.lovable.dev";
const CID = "microsoft_outlook";
const SCOPES = ["openid", "profile", "email", "offline_access", "User.Read", "Mail.ReadWrite", "Mail.Send"];

export type MailItem = { id: string; subject: string; from: string; fromAddr: string; date: string; preview: string; read: boolean };
export type MailFull = MailItem & { to: string; html: string };

async function keyFor(userId: string) {
  const { getConnectionKeyForUser } = await import("./app-user-connections.server");
  return getConnectionKeyForUser(userId, CID);
}

async function call(userId: string, path: string, init?: RequestInit) {
  const k = await keyFor(userId);
  if (!k) return { state: "disconnected" as const };
  const { callAsAppUser, appUserReconnectRequired } = await import("@/integrations/lovable/appUserConnector");
  const res = await callAsAppUser({ gatewayBaseUrl: GW, connectionAPIKey: k, connectorId: CID, path, init, requiredScopes: SCOPES });
  if (await appUserReconnectRequired(res)) return { state: "reconnect" as const };
  if (!res.ok) {
    const t = await res.text();
    console.error(`Outlook request failed [${res.status}]: ${t}`);
    throw new Error(`تعذر الاتصال بـ Outlook (${res.status})`);
  }
  return { state: "ok" as const, res };
}

type GMsg = { id: string; subject?: string; bodyPreview?: string; isRead?: boolean; receivedDateTime?: string;
  from?: { emailAddress?: { name?: string; address?: string } }; toRecipients?: { emailAddress?: { address?: string } }[]; body?: { content?: string; contentType?: string } };
const item = (m: GMsg): MailItem => ({
  id: m.id, subject: m.subject || "(بدون عنوان)", from: m.from?.emailAddress?.name || m.from?.emailAddress?.address || "",
  fromAddr: m.from?.emailAddress?.address || "", date: m.receivedDateTime || "", preview: m.bodyPreview || "", read: !!m.isRead,
});

export const startOutlookConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientKey = process.env['MICROSOFT_OUTLOOK_APP_USER_CONNECTOR_CLIENT_API_KEY'];
    if (!clientKey) throw new Error("ربط Outlook غير مُعد بعد");
    const request = getRequest();
    const url = new URL(request.url);
    const sandboxHost = url.hostname === "localhost" ? request.headers.get("x-forwarded-host") : null;
    const returnUrl = new URL("/api/oauth/outlook/return", sandboxHost ? `https://${sandboxHost}` : url.origin).toString();
    const existing = await keyFor(context.userId);
    const { authorizeAppUserOAuth } = await import("@/integrations/lovable/appUserConnector");
    const { authorizationUrl } = await authorizeAppUserOAuth({
      gatewayBaseUrl: GW, connectorId: CID, appUserId: context.userId, clientAPIKey: clientKey, returnUrl,
      connectionAPIKey: existing ?? undefined,
      credentialsConfiguration: { scopes: SCOPES, domain_hint: "organizations" },
    });
    return { authorizationUrl };
  });

export const completeOutlookConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { code: string }) => z.object({ code: z.string().min(1).max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { exchangeAppUserOAuthCode } = await import("@/integrations/lovable/appUserConnector");
    const { connectionAPIKey, connectorId } = await exchangeAppUserOAuthCode(GW, data.code);
    if (connectorId !== CID) throw new Error("OAuth completion returned the wrong connector");
    const { saveConnectionKeyForUser } = await import("./app-user-connections.server");
    await saveConnectionKeyForUser(context.userId, CID, connectionAPIKey);
    return { ok: true };
  });

export const disconnectOutlook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const k = await keyFor(context.userId);
    if (k) {
      const { disconnectAppUser } = await import("@/integrations/lovable/appUserConnector");
      await disconnectAppUser({ gatewayBaseUrl: GW, connectionAPIKey: k, connectorId: CID }).catch((e) => console.error(e));
      const { deleteConnectionKeyForUser } = await import("./app-user-connections.server");
      await deleteConnectionKeyForUser(context.userId, CID);
    }
    return { ok: true };
  });

export const listOutlookMail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { folder: string; q?: string | undefined }) => z.object({ folder: z.enum(["inbox", "sentitems", "drafts", "deleteditems", "junkemail"]), q: z.string().max(200).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const me = await call(context.userId, "/me?$select=displayName,mail,userPrincipalName");
    if (me.state !== "ok") return { state: me.state, me: null, items: [] as MailItem[] };
    const u = (await me.res.json()) as { displayName?: string; mail?: string; userPrincipalName?: string };
    const sel = "$select=id,subject,bodyPreview,isRead,receivedDateTime,from&$top=40";
    const path = data.q
      ? `/me/mailFolders/${data.folder}/messages?${sel}&$search=${encodeURIComponent(`"${data.q.replace(/"/g, "")}"`)}`
      : `/me/mailFolders/${data.folder}/messages?${sel}&$orderby=receivedDateTime desc`;
    const r = await call(context.userId, path);
    if (r.state !== "ok") return { state: r.state, me: null, items: [] as MailItem[] };
    const j = (await r.res.json()) as { value: GMsg[] };
    return { state: "ok" as const, me: { name: u.displayName ?? "", email: u.mail || u.userPrincipalName || "" }, items: j.value.map(item) };
  });

export const getOutlookMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().min(1).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const id = encodeURIComponent(data.id);
    const r = await call(context.userId, `/me/messages/${id}?$select=id,subject,bodyPreview,isRead,receivedDateTime,from,toRecipients,body`);
    if (r.state !== "ok") throw new Error("أعد ربط Outlook");
    const m = (await r.res.json()) as GMsg;
    if (!m.isRead) await call(context.userId, `/me/messages/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isRead: true }) }).catch(() => {});
    const html = m.body?.contentType === "html" ? m.body.content ?? "" : `<pre style="white-space:pre-wrap;font-family:inherit">${(m.body?.content ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!)}</pre>`;
    return { ...item(m), read: true, to: (m.toRecipients ?? []).map((x) => x.emailAddress?.address).filter(Boolean).join(", "), html } as MailFull;
  });

export const sendOutlookMail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { to: string; subject: string; body: string; replyTo?: string | undefined }) =>
    z.object({ to: z.string().max(1000), subject: z.string().max(500), body: z.string().max(50000), replyTo: z.string().max(500).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    if (data.replyTo) {
      const r = await call(context.userId, `/me/messages/${encodeURIComponent(data.replyTo)}/reply`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ comment: data.body }) });
      if (r.state !== "ok") throw new Error("أعد ربط Outlook");
      return { ok: true };
    }
    const to = data.to.split(/[,;\s]+/).filter(Boolean);
    if (!to.length || to.some((a) => !z.string().email().safeParse(a).success)) throw new Error("عنوان البريد غير صحيح");
    const r = await call(context.userId, "/me/sendMail", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: { subject: data.subject, body: { contentType: "Text", content: data.body }, toRecipients: to.map((address) => ({ emailAddress: { address } })) } }),
    });
    if (r.state !== "ok") throw new Error("أعد ربط Outlook");
    return { ok: true };
  });
