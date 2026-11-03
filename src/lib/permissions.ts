import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "./auth-session";

export type Role = "developer" | "admin" | "hr" | "viewer" | "manager" | "accountant" | "executive" | "mail" | "sales" | null;

/** The developer (Eng Abdelrhman) only sees the faults inbox, account settings and his Outlook mailbox. */
export const DEV_PATHS = ["/dev", "/mail", "/messages", "/my-checkin"];

/** Pages an HR-only account may open; everything else is hidden from them. */
export const HR_PATHS = ["/payroll", "/salary-deductions", "/attendance", "/attendance-tracking", "/workers-checkin", "/hr-dashboard", "/hr-file", "/residencies", "/leaves", "/documents", "/fleet", "/custody", "/establishment", "/est-payroll", "/settlements", "/performance", "/messages", "/mail", "/sales", "/my-checkin"];
/** Per-account menu trims: pages hidden from a specific account by its email (visible to everyone else). */
const ACCOUNT_HIDDEN_PATHS: Record<string, string[]> = {
  "haitham@metalfuze.local": ["/bank", "/hr-file", "/report"],
};
/** Paths hidden from the current signed-in account (empty for everyone else). */
export function useHiddenPaths() {
  const session = useAuthSession();
  const hidden = ACCOUNT_HIDDEN_PATHS[session?.user.email?.toLowerCase() ?? ""] ?? [];
  const access = useMyAccess();
  return access?.blocked_paths?.length ? [...hidden, ...access.blocked_paths] : hidden;
}

/** The developer's per-account access settings for the signed-in user (null = none). */
type MyAccess = { blocked_paths: string[]; read_only: boolean } | null;
let accessCache: { uid: string; p: Promise<MyAccess> } | null = null;
export function useMyAccess() {
  const session = useAuthSession();
  const uid = session?.user.id;
  const [a, setA] = useState<{ uid: string; value: MyAccess } | null>(null);
  useEffect(() => {
    let alive = true;
      if (!uid) { accessCache = null; return; }
      if (!accessCache || accessCache.uid !== uid) {
        accessCache = { uid, p: Promise.resolve(supabase.from("account_access").select("blocked_paths,read_only").eq("user_id", uid).maybeSingle()).then((r) => (r.data as MyAccess) ?? null, () => null) };
      }
      accessCache.p.then((value) => { if (alive) setA({ uid, value }); });
    return () => { alive = false; };
  }, [uid]);
  return a?.uid === uid ? a?.value ?? null : null;
}
/** HR pages (everything except employee data) that only admins (Eilaf, Abdelrhman) and HR may open; hidden from viewer accounts. */
export const HR_ADMIN_ONLY = ["/payroll", "/salary-deductions", "/attendance", "/attendance-tracking", "/workers-checkin", "/hr-dashboard", "/residencies", "/leaves", "/documents", "/fleet", "/custody", "/establishment", "/est-payroll", "/settlements", "/performance"];
/** Self-registered project managers (and accounts without a role) only get their own workspace. */
/** Accountants keep their private accounting space; the designated account also opens the dashboard. */
export const ACCOUNTANT_PATHS = ["/accounting", "/messages", "/mail", "/my-checkin"];
export function isProjectAccountant(role: Role | undefined, email: string | undefined) {
  return role === "accountant" && email?.toLowerCase() === "aiftkhar@metalfuze.local";
}
export function accountantPaths(projectAccountant: boolean) {
  return projectAccountant ? [...ACCOUNTANT_PATHS, "/"] : ACCOUNTANT_PATHS;
}
export function pathAllowed(path: string, allowed: string[]) {
  return allowed.some((p) => path === p || (p !== "/" && path.startsWith(p + "/")));
}
export function useIsProjectAccountant() {
  const role = useRole();
  return isProjectAccountant(role, useAuthSession()?.user.email);
}
export function useCanEditProjects() {
  const canEdit = useCanEdit();
  const accountant = useIsProjectAccountant();
  const ro = useMyAccess()?.read_only;
  return !ro && (canEdit || accountant);
}
/** Executive (Hisham) sees only the live summary, read-only. */
export const EXECUTIVE_PATHS = ["/executive", "/meetings", "/messages", "/mail", "/my-checkin"];
export const MANAGER_PATHS = ["/my-projects", "/messages", "/mail", "/my-checkin"];
/** Mail-only accounts open nothing but their Outlook mailbox. */
export const MAIL_PATHS = ["/mail", "/messages", "/my-checkin"];
/** Sales (Hala) only opens her own sales & commission space. */
export const SALES_PATHS = ["/sales", "/meetings", "/messages", "/mail", "/my-checkin"];

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
let roleCache: { uid: string; p: Promise<Role> } | null = null;
export function useRole() {
  const session = useAuthSession();
  const uid = session?.user.id;
  const [result, setResult] = useState<{ uid: string; role: Role } | null>(null);
  useEffect(() => {
    let alive = true;
    if (!uid) { roleCache = null; return; }
    if (!roleCache || roleCache.uid !== uid) {
      roleCache = { uid, p: Promise.resolve(supabase.from("user_roles").select("role").eq("user_id", uid)).then(({ data, error }) => {
      if (error) return null;
      const roles = (data ?? []).map((r) => String(r.role));
      const r: Role = roles.includes("developer") ? "developer" : roles.includes("admin") ? "admin" : roles.includes("hr") ? "hr" : roles.includes("viewer") ? "viewer" : roles.includes("accountant") ? "accountant" : roles.includes("executive") ? "executive" : roles.includes("mail") ? "mail" : roles.includes("sales") ? "sales" : "manager";
      return r;
      }, () => null) };
    }
    roleCache.p.then((role) => { if (alive) setResult({ uid, role }); });
    return () => { alive = false; };
  }, [uid]);
  if (session === undefined) return undefined;
  if (!uid) return null;
  return result?.uid === uid ? result.role : undefined;
}

/** Admins edit everything; HR edits only within the HR pages (the only ones they can open). */
export function useCanEdit() {
  const role = useRole();
  const ro = useMyAccess()?.read_only;
  return !ro && (role === "admin" || role === "hr");
}

/** HR data (employees, payroll, attendance, documents, leave) is edited by HR (Aisha) only; everyone else views. */
export function useCanEditHr() {
  const role = useRole();
  const ro = useMyAccess()?.read_only;
  return !ro && role === "hr";
}

/** Payments & collections: admins plus the CEO account (its records feed Hisham's summary). */
export function useCanEditPayments() {
  const role = useRole();
  const isCeo = useAuthSession()?.user.email === "ceo@metalfuze.local";
  const ro = useMyAccess()?.read_only;
  return !ro && (role === "admin" || isCeo);
}

/** Ali (ali@metalfuze.local) has his own blank "إدارة مشاريع" workspace instead of the dashboard. */
export const ALI_EMAIL = "ali@metalfuze.local";
export const ALI_PATHS = ["/project-admin", "/messages", "/mail", "/my-checkin"];
export function useIsAli() {
  const session = useAuthSession();
  return session === undefined ? undefined : session?.user.email === ALI_EMAIL;
}
