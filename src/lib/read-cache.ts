/**
 * Site-wide read cache for database reads (REST GET requests).
 * - Identical reads made at the same moment share one network request.
 * - A read result is reused for a short time (TTL), then fetched fresh.
 * - Any write (POST/PATCH/PUT/DELETE) to a table clears that table's cached reads.
 * - The cache key includes the caller's Authorization header, so users never see each other's data.
 */
type Entry = { at: number; status: number; statusText: string; headers: [string, string][]; body: ArrayBuffer };

export const READ_TTL_MS = 15_000;

export function createReadCache(ttl = READ_TTL_MS, now = () => Date.now()) {
  const done = new Map<string, Entry>();
  const inflight = new Map<string, Promise<Entry>>();
  const gen = new Map<string, number>();
  const tableKey = (k: string) => k.match(/\/rest\/v1\/([^?/|]+)/)?.[1] ?? "";
  return {
    async get(key: string, load: () => Promise<Entry>): Promise<Entry> {
      const hit = done.get(key);
      if (hit && now() - hit.at < ttl) return hit;
      const pending = inflight.get(key);
      if (pending) return pending;
      const tk = tableKey(key);
      const started = gen.get(tk) ?? 0;
      // A read that began before a write to its table is returned but never cached.
      const p = load().then((e) => { if (e.status >= 200 && e.status < 300 && (gen.get(tk) ?? 0) === started) done.set(key, e); return e; })
        .finally(() => inflight.delete(key));
      inflight.set(key, p);
      return p;
    },
    clearTable(table: string) {
      gen.set(table, (gen.get(table) ?? 0) + 1);
      for (const k of inflight.keys()) if (tableKey(k) === table) inflight.delete(k);
      for (const k of done.keys()) if (k.includes(`/rest/v1/${table}?`) || k.includes(`/rest/v1/${table}|`)) done.delete(k);
    },
    clearAll() { done.clear(); },
    size: () => done.size,
  };
}

const REST = "/rest/v1/";
function tableOf(url: string) {
  const i = url.indexOf(REST);
  if (i < 0) return null;
  return url.slice(i + REST.length).split(/[?/]/)[0] || null;
}

let installed = false;
export const readCache = createReadCache();

/** Installs the cache around window.fetch (browser only, once). */
export function installReadCache() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const base = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init);
    const table = tableOf(req.url);
    if (!table || table.startsWith("rpc") || table.startsWith("shared_")) return base(input, init);
    if (req.method !== "GET") {
      const res = await base(input, init);
      readCache.clearTable(table);
      return res;
    }
    const key = `${req.url}|${req.headers.get("authorization") ?? ""}|${req.headers.get("accept") ?? ""}|${req.headers.get("prefer") ?? ""}|${req.headers.get("range") ?? ""}`;
    const e = await readCache.get(key, async () => {
      const r = await base(input, init);
      return { at: Date.now(), status: r.status, statusText: r.statusText, headers: [...r.headers.entries()], body: await r.arrayBuffer() };
    });
    return new Response(e.body.slice(0), { status: e.status, statusText: e.statusText, headers: e.headers });
  };
}
