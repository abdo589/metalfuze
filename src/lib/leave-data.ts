import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { approvedLeaveDates, type LeaveRequest, type LeaveType } from "@/lib/leave-engine";

type Lite = Pick<LeaveRequest, "employee_id" | "start_date" | "end_date" | "status" | "type_id">;

/** Approved leave for attendance and payroll: days on leave are never counted as absence. */
export function useApprovedLeaves() {
  const [reqs, setReqs] = useState<Lite[]>([]);
  const [types, setTypes] = useState<Pick<LeaveType, "id" | "paid" | "name_ar" | "name_en">[]>([]);
  useEffect(() => {
    supabase.from("leave_requests").select("employee_id,start_date,end_date,status,type_id").eq("status", "approved")
      .then(({ data }) => { if (data) setReqs(data as Lite[]); });
    supabase.from("leave_types").select("id,paid,name_ar,name_en").then(({ data }) => { if (data) setTypes(data); });
  }, []);
  const dates = useMemo(() => approvedLeaveDates(reqs), [reqs]);
  return { reqs, types, dates };
}
