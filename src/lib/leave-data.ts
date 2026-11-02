import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { approvedLeaveDates, type LeaveRequest, type LeaveType } from "@/lib/leave-engine";
import { subscribeLiveRefresh } from "./live-refresh";

type Lite = Pick<LeaveRequest, "employee_id" | "start_date" | "end_date" | "status" | "type_id">;

/** Approved leave for attendance and payroll: days on leave are never counted as absence. */
export function useApprovedLeaves() {
  const [reqs, setReqs] = useState<Lite[]>([]);
  const [types, setTypes] = useState<Pick<LeaveType, "id" | "paid" | "name_ar" | "name_en">[]>([]);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [requests, leaveTypes] = await Promise.all([
        supabase.from("leave_requests").select("employee_id,start_date,end_date,status,type_id").eq("status", "approved"),
        supabase.from("leave_types").select("id,paid,name_ar,name_en"),
      ]);
      if (!alive) return;
      if (requests.data) setReqs(requests.data as Lite[]);
      if (leaveTypes.data) setTypes(leaveTypes.data);
    };
    void load();
    const stop = subscribeLiveRefresh(["leave_requests", "leave_types"], load);
    return () => { alive = false; stop(); };
  }, []);
  const dates = useMemo(() => approvedLeaveDates(reqs), [reqs]);
  return { reqs, types, dates };
}
