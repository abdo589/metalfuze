/** Per-account sign-in rules set by the developer. Empty lists / blank times mean "no limit". */
export type AccessRules = {
  days: number[]; // 0 = Sunday … 6 = Saturday (Riyadh time)
  start_time: string; // "HH:MM"
  end_time: string;
  allowed_ips: string[];
  devices: string[]; // "computer" | "mobile"
};

export const DAY_NAMES = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

/** Riyadh weekday (0=Sun) and minutes since midnight. */
export function riyadhClock(now: Date) {
  const r = new Date(now.getTime() + 3 * 3600_000);
  return { day: r.getUTCDay(), minutes: r.getUTCHours() * 60 + r.getUTCMinutes() };
}

const toMin = (s: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

export function deviceKind(ua: string): "mobile" | "computer" {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(ua) ? "mobile" : "computer";
}

/** Returns "" when allowed, otherwise the Arabic reason the sign-in is refused. */
export function checkAccess(r: AccessRules, ctx: { now: Date; ip: string; ua: string }): string {
  const { day, minutes } = riyadhClock(ctx.now);
  if (r.days.length && !r.days.includes(day)) return "الدخول غير مسموح في هذا اليوم";
  const s = toMin(r.start_time), e = toMin(r.end_time);
  if (s !== null && e !== null) {
    const inside = s <= e ? minutes >= s && minutes < e : minutes >= s || minutes < e; // overnight windows
    if (!inside) return `الدخول مسموح من ${r.start_time} إلى ${r.end_time} فقط`;
  }
  const ips = r.allowed_ips.map((x) => x.trim()).filter(Boolean);
  if (ips.length && !ips.some((p) => (p.endsWith("*") ? ctx.ip.startsWith(p.slice(0, -1)) : ctx.ip === p)))
    return "الدخول غير مسموح من هذا المكان";
  if (r.devices.length && !r.devices.includes(deviceKind(ctx.ua))) return "الدخول غير مسموح من هذا النوع من الأجهزة";
  return "";
}
