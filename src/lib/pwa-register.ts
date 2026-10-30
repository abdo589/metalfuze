// Only registrar of the offline service worker. Refuses dev, iframes and Lovable preview hosts.
const PREVIEW_LABEL = /^(?:id-preview|preview)(?:-[a-z0-9]+)?--.+$/;
function refused(): boolean {
  if (!import.meta.env.PROD) return true;
  try { if (window.self !== window.top) return true; } catch { return true; }
  const h = window.location.hostname.toLowerCase();
  const label = h.split(".")[0] ?? "";
  if ([".lovable.app", ".gpt-eng.com", ".gptengineer.run"].some((d) => h.endsWith(d)) && PREVIEW_LABEL.test(label)) return true;
  if (/^project--[^.]+-dev\.(lovable\.app|gpt-eng\.com|gptengineer\.run)$/.test(h)) return true;
  if (h === "id-preview--02a6c286-c077-48a7-9d7f-54c46553a921.lovable.app") return true;
  for (const d of ["lovableproject.com", "lovableproject-dev.com", "beta.lovable.dev"]) if (h === d || h.endsWith("." + d)) return true;
  if (new URLSearchParams(window.location.search).get("sw") === "off") return true;
  return false;
}
export async function registerAppSW() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  if (refused()) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.filter((r) => r.active?.scriptURL.endsWith("/sw.js") || r.installing?.scriptURL.endsWith("/sw.js") || r.waiting?.scriptURL.endsWith("/sw.js")).map((r) => r.unregister()));
    return;
  }
  navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
}
