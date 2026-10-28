import { supabase } from "@/integrations/supabase/client";
import { resetThreads } from "@/lib/threads";

const OWNER = "metalfuze.device-owner";
const PRIVATE_PREFIXES = ["metalfuze.ai-threads", "sales-draft:"];

/** Removes one account's private on-device data (advisor chats, unsaved drafts). */
export function clearPrivateDeviceData() {
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k && PRIVATE_PREFIXES.some((p) => k.startsWith(p))) localStorage.removeItem(k);
  }
  resetThreads();
}

/** Keeps private on-device data tied to the account that created it. */
export function installAccountScope() {
  const sync = (uid: string | null) => {
    const prev = localStorage.getItem(OWNER);
    if (!uid) { if (prev) clearPrivateDeviceData(); localStorage.removeItem(OWNER); return; }
    if (prev !== uid) { clearPrivateDeviceData(); localStorage.setItem(OWNER, uid); }
  };
  supabase.auth.getSession().then(({ data }) => sync(data.session?.user.id ?? null));
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") sync(null);
    else if (event === "SIGNED_IN" || event === "USER_UPDATED") sync(session?.user.id ?? null);
  });
}
