/**
 * Extra values a user typed where a dropdown offered "أخرى".
 * Stored in public.custom_options (one row per list + value) so every account sees them.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const OTHER = "أخرى";

const cache = new Map<string, string[]>();

/** base = the fixed options (may contain "أخرى"); returns base + saved extras, and add() to save a new one. */
export function useCustomOptions(list: string, base: string[]) {
  const [extra, setExtra] = useState<string[]>(() => cache.get(list) ?? []);
  useEffect(() => {
    if (cache.has(list)) return;
    let alive = true;
    supabase.from("custom_options").select("value").eq("list_name", list).order("value")
      .then(({ data }) => {
        const vals = (data ?? []).map((r) => String(r.value));
        cache.set(list, vals);
        if (alive) setExtra(vals);
      });
    return () => { alive = false; };
  }, [list]);

  /** Saves a typed value (re-adding an existing one is fine) and returns it, or null on failure. */
  const add = useCallback(async (value: string) => {
    const v = value.trim();
    if (!v) return null;
    const cur = cache.get(list) ?? [];
    const put = (val: string) => {
      const next = [...cur, val];
      cache.set(list, next);
      setExtra(next);
      return val;
    };
    if (cur.some((x) => x.toLowerCase() === v.toLowerCase())) return v;
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("custom_options").insert({ list_name: list, value: v, created_by: u.user?.id ?? null });
    if (error) {
      // Already saved by an earlier attempt or by someone else — use that copy.
      const { data } = await supabase.from("custom_options").select("value").eq("list_name", list).ilike("value", v).maybeSingle();
      return data ? put(String(data.value)) : null;
    }
    return put(v);
  }, [list]);

  const options = [...base.filter((o) => o !== OTHER), ...extra.filter((e) => !base.includes(e))];
  return { options, add };
}
