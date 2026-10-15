import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** True only for accounts holding the admin role; everyone else is view-only. */
export function useCanEdit() {
  const [can, setCan] = useState(false);
  useEffect(() => {
    let alive = true;
    const check = async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return alive && setCan(false);
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id).eq("role", "admin").maybeSingle();
      if (alive) setCan(!!data);
    };
    check();
    const { data: sub } = supabase.auth.onAuthStateChange(() => { check(); });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);
  return can;
}
