import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MAX = 25 * 1024 * 1024;

/** Turn share links (Google Drive, Dropbox, OneDrive) into direct-download URLs. */
export function directUrl(raw: string): string {
  const u = new URL(/^https?:\/\//i.test(raw) ? raw.replace(/^http:/i, "https:") : `https://${raw}`);
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

async function resolvesPrivate(host: string): Promise<boolean> {
  if (blocked(host)) return true;
  try {
    for (const t of ["A", "AAAA"]) {
      const r = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${t}`, { headers: { accept: "application/dns-json" } });
      const j = (await r.json()) as { Answer?: { type: number; data: string }[] };
      for (const a of j.Answer ?? []) if ((a.type === 1 || a.type === 28) && blocked(a.data)) return true;
    }
  } catch { return true; }
  return false;
}

/** HTTPS only, each redirect re-checked, stops at 25 MB, 30s timeout. */
async function safeFetch(start: string): Promise<{ res: Response; buf: Uint8Array } | { error: string }> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 30_000);
  try {
    let url = start;
    for (let hop = 0; hop < 6; hop++) {
      const u = new URL(url);
      if (u.protocol !== "https:") return { error: "روابط https فقط" };
      if (await resolvesPrivate(u.hostname)) return { error: "رابط غير مسموح" };
      const res = await fetch(url, { redirect: "manual", signal: ctl.signal });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) return { error: "تحويل غير صالح" };
        url = new URL(loc, url).toString();
        continue;
      }
      if (!res.ok) return { error: `تعذر تنزيل الملف (${res.status})` };
      if ((res.headers.get("content-type") ?? "").includes("text/html")) return { error: "الرابط صفحة وليس ملفًا — تأكد أن الملف مشارك للجميع" };
      if (Number(res.headers.get("content-length") ?? 0) > MAX) return { error: "الملف أكبر من 25 ميجا" };
      const reader = res.body?.getReader();
      if (!reader) return { error: "تعذر قراءة الملف" };
      const chunks: Uint8Array[] = []; let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX) { await reader.cancel(); return { error: "الملف أكبر من 25 ميجا" }; }
        chunks.push(value);
      }
      const buf = new Uint8Array(size); let o = 0;
      for (const c of chunks) { buf.set(c, o); o += c.byteLength; }
      return { res, buf };
    }
    return { error: "تحويلات كثيرة" };
  } catch { return { error: "انتهت مهلة التنزيل" }; }
  finally { clearTimeout(timer); }
}

/** Download the file behind a pasted link and store it in the caller's sales-files folder. */
export const pullLinkFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ url: z.string().min(4).max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    let target: string;
    try { target = directUrl(data.url.trim()); } catch { return { ok: false as const, error: "رابط غير صالح" }; }
    const got = await safeFetch(target);
    if ("error" in got) return { ok: false as const, error: got.error };
    const { res, buf } = got;
    const type = res.headers.get("content-type") ?? "application/octet-stream";
    const cd = res.headers.get("content-disposition") ?? "";
    let name = decodeURIComponent(cd.match(/filename\*=UTF-8''([^;]+)/i)?.[1] ?? cd.match(/filename="?([^";]+)"?/i)?.[1] ?? "")
      || decodeURIComponent(new URL(res.url || target).pathname.split("/").pop() || "") || "file";
    name = name.replace(/[^\w.\-\u0600-\u06FF]/g, "_").slice(0, 120);
    const path = `${context.userId}/${Date.now()}_${name}`;
    const { error } = await context.supabase.storage.from("sales-files").upload(path, buf, { contentType: type });
    if (error) return { ok: false as const, error: "تعذر حفظ الملف" };
    return { ok: true as const, path };
  });
