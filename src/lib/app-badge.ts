// Laptop/phone red counter: one number shown on the browser-tab icon and on the installed app's taskbar icon.
import { WF } from "./sales-form";
import { canActOnSalesStep } from "./ceo-access";

/** Text drawn inside the red circle; null hides the circle. */
export function badgeLabel(n: number): string | null {
  if (!Number.isFinite(n) || n <= 0) return null;
  return n > 99 ? "99+" : String(Math.floor(n));
}

/** Sales requests currently waiting on this account's approval step. */
export function salesWaitingCount(steps: readonly string[], myEmail?: string | null): number {
  return steps.filter((step) => step !== "sales_entry" && canActOnSalesStep(step, WF.find((s) => s.k === step)?.email, myEmail)).length;
}

/** Whether this account owns any approval step (others never need the sales query). */
export function hasSalesStep(myEmail?: string | null): boolean {
  return WF.some((s) => s.k !== "sales_entry" && canActOnSalesStep(s.k, s.email, myEmail));
}

let originalIcon: string | null = null;
let iconImage: Promise<HTMLImageElement> | null = null;

function loadIcon(src: string) {
  iconImage ??= new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
  return iconImage;
}

function cssColor(name: string, fallback: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/** Draws the red counter on the tab icon (any browser) and sets the installed-app icon badge. */
export async function showAppBadge(n: number) {
  const label = badgeLabel(n);
  const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
  try {
    if (label) nav.setAppBadge?.(n)?.catch(() => {});
    else nav.clearAppBadge?.()?.catch(() => {});
  } catch { /* unsupported */ }

  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) return;
  originalIcon ??= link.getAttribute("href") ?? "/favicon.png";
  if (!label) { link.href = originalIcon; return; }
  try {
    const img = await loadIcon(originalIcon);
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, size, size);
    const r = label.length > 2 ? 22 : 18;
    const cx = size - r, cy = r;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = cssColor("--destructive", "red");
    ctx.fill();
    ctx.fillStyle = cssColor("--destructive-foreground", "white");
    ctx.font = `bold ${label.length > 2 ? 20 : 26}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, cx, cy + 1);
    // Only apply if the count is still current when the drawing finishes.
    if (badgeLabel(currentCount) === label) link.href = canvas.toDataURL("image/png");
  } catch { /* keep the plain icon */ }
}

let currentCount = 0;
export function setAppBadgeCount(n: number) {
  currentCount = n;
  void showAppBadge(n);
}
