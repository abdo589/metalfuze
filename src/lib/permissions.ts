import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Role = "admin" | "hr" | "viewer" | "manager" | null;

/** Pages an HR-only account may open; everything else is hidden from them. */
export const HR_PATHS = ["/payroll", "/attendance", "/workers-checkin", "/hr-dashboard", "/hr-file", "/residencies", "/leaves", "/messages"];
/** Self-registered project managers (and accounts without a role) only get their own workspace. */
export const MANAGER_PATHS = ["/my-projects", "/messages"];

/** Current user's strongest role (admin > hr > viewer > manager). Accounts without a role are treated as manager. undefined while loading. */
export function useRole() {
  const [role, setRole] = useState<Role | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    const check = async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return alive && setRole(null);
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
      const roles = (data ?? []).map((r) => String(r.role));
      const r: Role = roles.includes("admin") ? "admin" : roles.includes("hr") ? "hr" : roles.includes("viewer") ? "viewer" : "manager";
      if (alive) setRole(r);
    };
    check();
    const { data: sub } = supabase.auth.onAuthStateChange(() => { check(); });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);
  return role;
}

/** Admins edit everything; HR edits only within the HR pages (the only ones they can open). */
export function useCanEdit() {
  const role = useRole();
  return role === "admin" || role === "hr";
}
