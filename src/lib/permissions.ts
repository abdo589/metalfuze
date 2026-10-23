import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Role = "developer" | "admin" | "hr" | "viewer" | "manager" | "accountant" | "executive" | "mail" | "sales" | null;

/** The developer (Eng Abdelrhman) only sees the faults inbox, account settings and his Outlook mailbox. */
export const DEV_PATHS = ["/dev", "/mail"];

/** Pages an HR-only account may open; everything else is hidden from them. */
export const HR_PATHS = ["/payroll", "/attendance", "/attendance-tracking", "/workers-checkin", "/hr-dashboard", "/hr-file", "/residencies", "/leaves", "/documents", "/fleet", "/custody", "/establishment", "/est-payroll", "/settlements", "/performance", "/messages", "/mail", "/sales"];
/** HR pages (everything except employee data) that only admins (Eilaf, Abdelrhman) and HR may open; hidden from viewer accounts. */
export const HR_ADMIN_ONLY = ["/payroll", "/attendance", "/attendance-tracking", "/workers-checkin", "/hr-dashboard", "/residencies", "/leaves", "/documents", "/fleet", "/custody", "/establishment", "/est-payroll", "/settlements", "/performance"];
/** Self-registered project managers (and accounts without a role) only get their own workspace. */
/** Accountant (Aiftkhar) sees only the private accounting space. */
export const ACCOUNTANT_PATHS = ["/accounting", "/messages", "/mail"];
/** Executive (Hisham) sees only the live summary, read-only. */
export const EXECUTIVE_PATHS = ["/executive", "/messages", "/mail"];
export const MANAGER_PATHS = ["/my-projects", "/messages", "/mail"];
/** Mail-only accounts open nothing but their Outlook mailbox. */
export const MAIL_PATHS = ["/mail"];
/** Sales (Hala) only opens her own sales & commission space. */
export const SALES_PATHS = ["/sales", "/messages"];

/** Who may open the AI advisor (/assistant) — mirrors RoleGuard's allowed lists, so the floating button never links to a blocked page. */
export function assistantAllowed(role: Role | undefined) {
  if (!role) return false;
  const lists: Partial<Record<Exclude<Role, null>, string[]>> = {
    hr: HR_PATHS, manager: MANAGER_PATHS, accountant: ACCOUNTANT_PATHS,
    executive: EXECUTIVE_PATHS, mail: MAIL_PATHS, sales: SALES_PATHS, developer: DEV_PATHS,
  };
  const list = lists[role];
  return list ? list.includes("/assistant") : true; // admin and viewer accounts keep the advisor
}

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
      const r: Role = roles.includes("developer") ? "developer" : roles.includes("admin") ? "admin" : roles.includes("hr") ? "hr" : roles.includes("viewer") ? "viewer" : roles.includes("accountant") ? "accountant" : roles.includes("executive") ? "executive" : roles.includes("mail") ? "mail" : roles.includes("sales") ? "sales" : "manager";
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

/** HR data (employees, payroll, attendance, documents, leave) is edited by HR (Aisha) only; everyone else views. */
export function useCanEditHr() {
  return useRole() === "hr";
}

/** Payments & collections: admins plus the CEO account (its records feed Hisham's summary). */
export function useCanEditPayments() {
  const role = useRole();
  const [isCeo, setIsCeo] = useState(false);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setIsCeo(data.user?.email === "ceo@metalfuze.local")); }, []);
  return role === "admin" || isCeo;
}
