import { checkSite, isRepeat } from "./geo";

export type CheckinInput = { employeeId: string; action: "in" | "out"; lat: number; lng: number; photo: string };
export type CheckinResult = { ok: true; time: string; distance: number; site: string } | { ok: false; error: string };

function decodePhoto(dataUrl: string) {
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return null;
  const bin = atob(m[2]!);
  if (bin.length > 2 * 1024 * 1024) return null;
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, type: `image/${m[1]}`, ext: m[1] === "jpeg" ? "jpg" : m[1]! };
}

/** Validates location + selfie and stores a remote punch. Server-only (uses the admin client). */
export async function recordRemotePunch(input: CheckinInput): Promise<CheckinResult> {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng) || Math.abs(input.lat) > 90 || Math.abs(input.lng) > 180)
    return { ok: false, error: "location" };
  const photo = decodePhoto(input.photo);
  if (!photo) return { ok: false, error: "photo" };

  const { data: emp } = await db.from("employees").select("id,active,device_user_id,site_id").eq("id", input.employeeId).maybeSingle();
  if (!emp || !emp.active) return { ok: false, error: "employee" };
  // No assigned work site: accept the punch and just record the exact GPS location (no radius check).
  const { data: siteRow } = emp.site_id
    ? await db.from("work_sites").select("name,lat,lng,radius_m").eq("id", emp.site_id).maybeSingle()
    : { data: null };
  const site = siteRow ?? { name: "", lat: input.lat, lng: input.lng, radius_m: 0 };

  const check = siteRow ? checkSite(input, site) : { ok: true as const, distance: 0 };
  if (!check.ok) return { ok: false, error: `far:${check.distance}:${site.name}` };

  const userId = emp.device_user_id || emp.id;
  const status = input.action === "in" ? 0 : 1;
  const { data: last } = await db.from("attendance_logs").select("punched_at").eq("device_sn", "REMOTE")
    .eq("device_user_id", userId).eq("status", status).order("punched_at", { ascending: false }).limit(1).maybeSingle();
  const now = new Date();
  if (isRepeat(last?.punched_at, now.getTime())) return { ok: true, time: last!.punched_at, distance: check.distance, site: site.name };

  const path = `${emp.id}/${now.toISOString().replace(/[:.]/g, "-")}-${input.action}.${photo.ext}`;
  const up = await db.storage.from("attendance-selfies").upload(path, photo.bytes, { contentType: photo.type });
  if (up.error) { console.error("selfie upload failed", up.error); return { ok: false, error: "save" }; }

  const { error } = await db.from("attendance_logs").insert({
    device_sn: "REMOTE", device_user_id: userId, punched_at: now.toISOString(), status, source: "remote",
    lat: input.lat, lng: input.lng, distance_m: siteRow ? check.distance : null, photo_path: path, site_name: siteRow ? site.name : null,
  });
  if (error) { console.error("remote punch insert failed", error); return { ok: false, error: "save" }; }
  return { ok: true, time: now.toISOString(), distance: check.distance, site: site.name };
}

/** Location update while on shift: stored only after an arrival with no leaving since, at most every 2 minutes. */
export async function recordPing(employeeId: string, lat: number, lng: number, accuracy?: number): Promise<{ ok: boolean; onShift: boolean }> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return { ok: false, onShift: false };
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { data: emp } = await db.from("employees").select("id,device_user_id,site_id").eq("id", employeeId).maybeSingle();
  if (!emp) return { ok: false, onShift: false };
  const since = new Date(Date.now() - 16 * 3600_000).toISOString();
  const { data: last } = await db.from("attendance_logs").select("status").eq("device_user_id", emp.device_user_id || emp.id)
    .gte("punched_at", since).order("punched_at", { ascending: false }).limit(1).maybeSingle();
  if (!last || last.status !== 0) return { ok: true, onShift: false };
  const { data: prev } = await db.from("location_pings").select("pinged_at").eq("employee_id", emp.id).order("pinged_at", { ascending: false }).limit(1).maybeSingle();
  if (prev && Date.now() - new Date(prev.pinged_at).getTime() < 110_000) return { ok: true, onShift: true };
  let distance: number | null = null;
  if (emp.site_id) {
    const { data: s } = await db.from("work_sites").select("lat,lng,radius_m").eq("id", emp.site_id).maybeSingle();
    if (s) distance = checkSite({ lat, lng }, s).distance;
  }
  await db.from("location_pings").insert({ employee_id: emp.id, lat, lng, accuracy_m: accuracy ? Math.round(accuracy) : null, distance_m: distance });
  return { ok: true, onShift: true };
}
