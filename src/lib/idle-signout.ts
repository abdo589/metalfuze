/** Signed-in users are logged out once this much time passes without any activity. */
export const IDLE_MS = 60 * 60 * 1000;

/** How long before the cut-off the user is told the session is about to end. */
export const WARN_MS = 5 * 60 * 1000;

/** Saved in shared browser storage so activity in any open window keeps them all alive. */
export const ACTIVITY_KEY = "metalfuze.last-activity";

/** True once the user has been idle for at least the whole allowed period. */
export function idleExpired(lastActivity: number, now: number, idleMs = IDLE_MS) {
  return now - lastActivity >= idleMs;
}

/** True only inside the final warning window — past the cut-off it's a sign-out, not a warning. */
export function warnSoon(lastActivity: number, now: number, idleMs = IDLE_MS, warnMs = WARN_MS) {
  const idle = now - lastActivity;
  return idle >= idleMs - warnMs && idle < idleMs;
}

/** When the user was last seen; a missing or broken stamp counts as "just now". */
export function readLastActivity(now = Date.now()): number {
  try {
    const stored = Number(localStorage.getItem(ACTIVITY_KEY));
    return Number.isFinite(stored) && stored > 0 ? stored : now;
  } catch {
    return now;
  }
}

/** Record that the user is here right now. */
export function touchActivity(now = Date.now()) {
  try {
    localStorage.setItem(ACTIVITY_KEY, String(now));
  } catch {
    /* Storage unavailable — the idle clock simply won't persist. */
  }
}
