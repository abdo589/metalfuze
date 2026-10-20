import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Punch } from "./attendance";

/** Punches for a YYYY-MM month (Riyadh time), refreshed live when the device pushes new ones. */
export function useMonthPunches(month: string, tick = 0) {
  const [punches, setPunches] = useState<Punch[]>([]);
  useEffect(() => {
    let alive = true;
    const [y, m] = month.split("-").map(Number);
    const from = new Date(Date.UTC(y!, m! - 1, 1) - 3 * 3600_000).toISOString();
    const to = new Date(Date.UTC(y!, m!, 1) - 3 * 3600_000).toISOString();
    const load = async () => {
      const { data } = await supabase.from("attendance_logs").select("device_user_id,punched_at,source,status,distance_m,photo_path,site_name,lat,lng")
        .gte("punched_at", from).lt("punched_at", to).order("punched_at").limit(20000);
      if (alive && data) setPunches(data);
    };
    load();
    const id = setInterval(load, 30_000);
    return () => { alive = false; clearInterval(id); };
  }, [month, tick]);
  return punches;
}
