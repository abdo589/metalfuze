/** Documents expiring within this many days trigger an alert. */
export const ALERT_DAYS = 60;

export type DocStatus = "expired" | "soon" | "valid" | "none";

export function daysLeft(date: string | null, today = new Date().toISOString().slice(0, 10)) {
  if (!date) return null;
  return Math.round((Date.parse(date) - Date.parse(today)) / 86_400_000);
}

export function docStatus(days: number | null): DocStatus {
  if (days === null) return "none";
  if (days < 0) return "expired";
  return days <= ALERT_DAYS ? "soon" : "valid";
}
