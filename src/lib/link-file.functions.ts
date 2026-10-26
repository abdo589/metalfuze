import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MAX = 25 * 1024 * 1024;

/** Turn share links (Google Drive, Dropbox, OneDrive) into direct-download URLs. */
export function directUrl(raw: string): string {
  const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  if (u.hostname.endsWith("drive.google.com")) {
    const id = u.pathname.match(/\/d\/([^/]+)/)?.[1] ?? u.searchParams.get("id");
    if (id) return `https://drive.google.com/uc?export=download&confirm=t&id=${id}`;
  }
  if (u.hostname.endsWith("docs.google.com")) {
    const m = u.pathname.match(/\/(document|spreadsheets|presentation)\/d\/([^/]+)/);
    if (m) return `https://docs.google.com/${m[1]}/d/${m[2]}/export?format=${m[1] === "document" ? "pdf" : m[1] === "spreadsheets" ? "xlsx" : "pdf"}`;
  }
  if (u.hostname.endsWith("dropbox.com")) { u.searchParams.set("dl", "1"); return u.toString(); }
  if (u.hostname.includes("1drv.ms") || u.hostname.includes("sharepoint.com") || u.hostname.includes("onedrive.live.com")) {
    u.searchParams.set("download", "1"); return u.toString();
  }
  return u.toString();
}

const blocked = (h: string) =>
  /^(localhost|0\.|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?|\[?f[cd])/i.test(h) || !h.includes(".");

/** Download the file behind a pasted link and store it in the caller's sales-files folder. */
export const pullLinkFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ url: z.string().min(4).max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    let target: string;
    try { target = directUrl(data.url.trim()); } catch { return { ok: false as const, error: "رابط غير صالح" }; }
    const host = new URL(target).hostname;
    if (blocked(host)) return { ok: false as const, error: "رابط غير مسموح" };
    const res = await fetch(target, { redirect: "follow" });
    if (!res.ok) return { ok: false as const, error: `تعذر تنزيل الملف (${res.status})` };
    const type = res.headers.get("content-type") ?? "application/octet-stream";
    if (type.includes("text/html")) return { ok: false as const, error: "الرابط صفحة وليس ملفًا — تأكد أن الملف مشارك للجميع" };
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX) return { ok: false as const, error: "الملف أكبر من 25 ميجا" };
    const cd = res.headers.get("content-disposition") ?? "";
    let name = decodeURIComponent(cd.match(/filename\*=UTF-8''([^;]+)/i)?.[1] ?? cd.match(/filename="?([^";]+)"?/i)?.[1] ?? "")
      || decodeURIComponent(new URL(res.url || target).pathname.split("/").pop() || "") || "file";
    name = name.replace(/[^\w.\-\u0600-\u06FF]/g, "_").slice(0, 120);
    const path = `${context.userId}/${Date.now()}_${name}`;
    const { error } = await context.supabase.storage.from("sales-files").upload(path, buf, { contentType: type });
    if (error) return { ok: false as const, error: "تعذر حفظ الملف" };
    return { ok: true as const, path };
  });
