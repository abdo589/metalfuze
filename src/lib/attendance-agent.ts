// Shared rules for punches arriving from the office attendance agent (pull mode).
// The agent reads the ZKTeco device on the office LAN and posts batches with a secret token,
// so forged pushes from anyone who only knows the device serial are rejected.

export type AgentPunch = { device_user_id: string; punched_at: string; status: number | null };

/** Keep only plausible punches: numeric PINs, valid times, not in the future, max 45 days old, max 5000. */
export function filterAgentPunches(input: unknown, now = Date.now()): AgentPunch[] {
  if (!Array.isArray(input)) return [];
  const out: AgentPunch[] = [];
  for (const r of input) {
    if (!r || typeof r !== "object") continue;
    const pin = String((r as Record<string, unknown>).device_user_id ?? "").trim();
    const at = String((r as Record<string, unknown>).punched_at ?? "");
    const st = (r as Record<string, unknown>).status;
    const t = Date.parse(at);
    if (!/^\d{1,9}$/.test(pin) || !Number.isFinite(t)) continue;
    if (t > now + 10 * 60_000 || t < now - 45 * 86_400_000) continue;
    out.push({ device_user_id: pin, punched_at: new Date(t).toISOString(), status: typeof st === "number" && Number.isInteger(st) ? st : null });
    if (out.length >= 5000) break;
  }
  return out;
}

/** Constant-time comparison so the token can't be guessed by timing. */
export function tokenMatches(given: string, expected: string): boolean {
  if (!expected || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
