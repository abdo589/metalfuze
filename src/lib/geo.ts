/** Great-circle distance in metres (haversine). */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/** A remote check-in is accepted only inside the site's allowed radius. */
export function checkSite(pos: { lat: number; lng: number }, site: { lat: number; lng: number; radius_m: number }) {
  const distance = distanceM(pos, site);
  return { ok: distance <= site.radius_m, distance };
}

export const REPEAT_WINDOW_MS = 60_000;
/** Repeated taps of the same action within one minute are ignored. */
export function isRepeat(lastAt: string | null | undefined, now = Date.now()) {
  return !!lastAt && now - new Date(lastAt).getTime() < REPEAT_WINDOW_MS;
}
