import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { t } from "@/lib/i18n";
import { idleExpired, readLastActivity, touchActivity, warnSoon } from "@/lib/idle-signout";
import { signOutTracked } from "@/lib/login-tracking";
import { shouldForceOut } from "@/lib/force-logout";
import { checkMyAccess } from "@/lib/access.functions";

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "scroll", "touchstart", "focus"] as const;
const HEARTBEAT_MS = 15 * 1000; // how often "I'm here" is written down
const CHECK_MS = 20 * 1000; // how often the idle clock is checked

/**
 * Signs a user out after an hour without touching anything. The stamp they were last
 * seen is shared by every open window of the app, so working in one keeps the others alive.
 */
export function IdleSignOut() {
  useEffect(() => {
    let warned = false;
    let lastWrite = 0;
    let lastFlagCheck = 0;

    const mark = () => {
      warned = false; // any activity cancels the coming sign-out
      const now = Date.now();
      if (now - lastWrite < HEARTBEAT_MS) return;
      lastWrite = now;
      touchActivity(now);
    };

    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return; // nobody signed in — nothing to end
      const now = Date.now();
      if (now - lastFlagCheck > 55_000 || lastFlagCheck === 0) {
        lastFlagCheck = now;
        const u = data.session.user;
        const { data: flag } = await supabase.from("account_flags").select("force_logout_at").eq("user_id", u.id).maybeSingle();
        if (shouldForceOut(u.last_sign_in_at, flag?.force_logout_at)) {
          await signOutTracked();
          toast.info(t("تم تسجيل خروجك بواسطة المبرمج"));
          return;
        }
        try {
          const { reason } = await checkMyAccess();
          if (reason) { await signOutTracked(); toast.error(t(reason), { duration: 15000 }); return; }
        } catch { /* network hiccup — check again next round */ }
      }
      const last = readLastActivity(now);
      if (idleExpired(last, now)) {
        warned = false;
        touchActivity(now); // tell the other open windows this one is already handled
        await signOutTracked();
        toast.info(t("تم تسجيل الخروج لعدم النشاط"));
        return;
      }
      if (warnSoon(last, now) && !warned) {
        warned = true;
        toast.warning(t("سيتم تسجيل الخروج خلال 5 دقائق لعدم النشاط"), { duration: 20000 });
      }
    };

    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, mark, { passive: true, capture: true }));
    const onShow = () => { if (!document.hidden) check(); };
    document.addEventListener("visibilitychange", onShow);

    const { data: auth } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") { warned = false; touchActivity(); } // a fresh login starts a fresh hour
    });

    const timer = setInterval(check, CHECK_MS);
    check();

    return () => {
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, mark, { capture: true }));
      document.removeEventListener("visibilitychange", onShow);
      clearInterval(timer);
      auth.subscription.unsubscribe();
    };
  }, []);

  return null;
}
