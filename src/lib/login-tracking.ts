import { supabase } from "@/integrations/supabase/client";
import { logLoginEvent } from "@/lib/login-events.functions";

const KEY = "mf-login-logged";

/** Logs one "login" per session (deduped across reloads). */
export async function trackLogin(userId: string) {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(KEY) === userId) return;
  localStorage.setItem(KEY, userId);
  try { await logLoginEvent({ data: { event: "login", device: navigator.userAgent } }); } catch { localStorage.removeItem(KEY); }
}

/** Logs "logout" while the session is still valid, then signs out. */
export async function signOutTracked() {
  try { await logLoginEvent({ data: { event: "logout", device: navigator.userAgent } }); } catch { /* ignore */ }
  localStorage.removeItem(KEY);
  localStorage.removeItem("mf-switch-accounts");
  await supabase.auth.signOut();
}
