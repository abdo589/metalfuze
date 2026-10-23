export function deviceLabel(ua: string) {
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "—";
  const br = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "";
  return `${os}${br ? " · " + br : ""}`;
}

/** A login is suspicious when the account has earlier logins and none came from this country or this device type. */
export function assessLogin(prev: { country: string; device: string }[], cur: { country: string; device: string }) {
  if (!prev.length) return { suspicious: false, reason: "" };
  const reasons: string[] = [];
  if (cur.country && !prev.some((p) => p.country === cur.country)) reasons.push("دولة جديدة");
  const d = deviceLabel(cur.device);
  if (!prev.some((p) => deviceLabel(p.device) === d)) reasons.push("جهاز جديد");
  return { suspicious: reasons.length > 0, reason: reasons.join("، ") };
}
