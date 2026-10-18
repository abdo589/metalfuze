import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Residency = Database["public"]["Tables"]["residencies"]["Row"];
export const DOCS = [
  { key: "iqama_expiry", label: "الإقامة" },
  { key: "permit_expiry", label: "رخصة العمل" },
  { key: "insurance_expiry", label: "التأمين الصحي" },
  { key: "contract_expiry", label: "العقد" },
] as const;

export function useResidencies() {
  const [rows, setRows] = useState<Residency[]>([]);
  const reload = useCallback(async () => {
    const { data } = await supabase.from("residencies").select("*").order("iqama_expiry");
    if (data) setRows(data);
  }, []);
  useEffect(() => { reload(); }, [reload]);
  return { rows, reload };
}
