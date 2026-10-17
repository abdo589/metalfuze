import type { Employee } from "./payroll";

/** Work rules: day starts 09:00, arrival after 09:30 counts as late. Weekend Fri/Sat (KSA). */
export const WORK_START = "09:00";
export const LATE_AFTER = "09:30";
export const WEEKEND = [5, 6];

export type Punch = {
  device_user_id: string; punched_at: string; source?: string | null; status?: number | null;
  distance_m?: number | null; photo_path?: string | null; site_name?: string | null;
};
export type DayRecord = { date: string; in: string; out: string | null; late: boolean; lateMin: number };

/** Riyadh (UTC+3) local date + time for a timestamp. */
export function riyadh(ts: string) {
  const d = new Date(new Date(ts).getTime() + 3 * 3600_000);
  const iso = d.toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

const mins = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return h! * 60 + m!; };

export function buildDays(punches: Punch[], userId: string | string[]): DayRecord[] {
  const ids = new Set(Array.isArray(userId) ? userId : [userId]);
  const byDay = new Map<string, string[]>();
  for (const p of punches) {
    if (!ids.has(p.device_user_id)) continue;
    const { date, time } = riyadh(p.punched_at);
    byDay.set(date, [...(byDay.get(date) ?? []), time]);
  }
  return [...byDay.entries()].sort().map(([date, times]) => {
    times.sort();
    const first = times[0]!;
    const last = times.length > 1 ? times[times.length - 1]! : null;
    const late = mins(first) > mins(LATE_AFTER);
    return { date, in: first, out: last, late, lateMin: late ? mins(first) - mins(WORK_START) : 0 };
  });
}

/** Working days (excluding weekend) of the month up to today. */
export function workDays(month: string, today = riyadh(new Date().toISOString()).date) {
  const [y, m] = month.split("-").map(Number);
  const out: string[] = [];
  for (let d = 1; d <= 31; d++) {
    const dt = new Date(Date.UTC(y!, m! - 1, d));
    if (dt.getUTCMonth() !== m! - 1) break;
    const iso = dt.toISOString().slice(0, 10);
    if (iso > today) break;
    if (!WEEKEND.includes(dt.getUTCDay())) out.push(iso);
  }
  return out;
}

export function summarize(e: Employee, punches: Punch[], month: string) {
  // Remote phone punches use the device id when set, otherwise the employee id.
  const ids = [e.id, ...(e.deviceUserId ? [e.deviceUserId] : [])];
  const days = buildDays(punches, ids).filter((d) => d.date.startsWith(month));
  const linked = !!e.deviceUserId || !!e.siteId || days.length > 0;
  const wd = workDays(month);
  const present = new Set(days.map((d) => d.date));
  return {
    days,
    present: days.length,
    late: days.filter((d) => d.late).length,
    absent: linked ? wd.filter((d) => !present.has(d)).length : 0,
    linked,
  };
}

/** Parse a ZKTeco ADMS ATTLOG body: PIN\tYYYY-MM-DD HH:MM:SS\tstatus... (device clock in Riyadh time). */
export function parseAttlog(body: string) {
  const out: { device_user_id: string; punched_at: string; status: number | null }[] = [];
  for (const line of body.split(/\r?\n/)) {
    const [pin, ts, status] = line.split("\t");
    if (!pin?.trim() || !ts || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(ts.trim())) continue;
    out.push({ device_user_id: pin.trim(), punched_at: `${ts.trim().replace(" ", "T")}+03:00`, status: status ? Number(status) : null });
  }
  return out;
}
