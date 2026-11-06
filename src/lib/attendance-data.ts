import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Punch } from "./attendance";
import { subscribeLiveRefresh } from "./live-refresh";
import { readAllPages } from "./read-all-pages";

/** Punches for a YYYY-MM month (Riyadh time), refreshed live when the device pushes new ones. */
export function useMonthPunches(month: string, tick = 0) {
  const [punches, setPunches] = useState<Punch[]>([]);
  useEffect(() => {
    let alive = true;
    const [y, m] = month.split("-").map(Number);
    if (y === undefined || m === undefined || !Number.isFinite(y) || !Number.isInteger(m) || m < 1 || m > 12) return;
    const from = new Date(Date.UTC(y, m - 1, 1) - 3 * 3600_000).toISOString();
    const to = new Date(Date.UTC(y, m, 1) - 3 * 3600_000).toISOString();
    let loading = false;
    let queued = false;
    const load = async () => {
      if (loading) { queued = true; return; }
      loading = true;
      try {
        const data = await readAllPages((start, end) => supabase.from("attendance_logs")
          .select("device_user_id,punched_at,source,status,distance_m,photo_path,site_name,lat,lng")
          .gte("punched_at", from).lt("punched_at", to).order("punched_at").order("id").range(start, end));
        if (alive) setPunches(data);
      } catch { /* Keep the last complete result on a failed refresh. */ }
      finally {
        loading = false;
        if (queued && alive) { queued = false; void load(); }
      }
    };
    load();
    const stop = subscribeLiveRefresh(["attendance_logs"], load);
    return () => { alive = false; stop(); };
  }, [month, tick]);
  return punches;
}
