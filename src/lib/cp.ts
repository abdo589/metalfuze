import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type CpProject = Database["public"]["Tables"]["projects"]["Row"];
export type CpContract = Database["public"]["Tables"]["project_contracts"]["Row"];
export type CpMember = Database["public"]["Tables"]["project_members"]["Row"];

export const STATUSES = [
  { v: "planning", ar: "تخطيط", en: "Planning" },
  { v: "active", ar: "جاري", en: "Active" },
  { v: "on_hold", ar: "متوقف", en: "On hold" },
  { v: "completed", ar: "منتهي", en: "Completed" },
] as const;

export const ACCESS_ROLES = [
  { v: "admin", ar: "مدير النظام", en: "Admin" },
  { v: "project_manager", ar: "مدير مشروع", en: "Project manager" },
  { v: "site_engineer", ar: "مهندس موقع", en: "Site engineer" },
  { v: "document_controller", ar: "مراقب وثائق", en: "Document controller" },
  { v: "planner", ar: "مخطط", en: "Planner" },
  { v: "accountant", ar: "محاسب", en: "Accountant" },
  { v: "viewer", ar: "مشاهد", en: "Viewer" },
] as const;

export const JOBS = ["مدير مشروع", "مهندس موقع", "مشرف", "مدير سلامة", "مسؤول سلامة", "عمالة", "كهرباء", "ميكانيكا", "مقاول من الباطن", "مكتب فني", "أمين مخزن", "مراقب وثائق", "حارس"];

export const statusLabel = (v: string, lang: string) => {
  const s = STATUSES.find((x) => x.v === v);
  return s ? (lang === "en" ? s.en : s.ar) : v;
};

export const statusClass: Record<string, string> = {
  planning: "bg-secondary text-secondary-foreground",
  active: "bg-primary/15 text-primary",
  on_hold: "bg-destructive/15 text-destructive",
  completed: "bg-muted text-muted-foreground",
};

export const cpKeys = {
  projects: ["cp", "projects"] as const,
  project: (id: string) => ["cp", "project", id] as const,
  contract: (id: string) => ["cp", "contract", id] as const,
  members: (id: string) => ["cp", "members", id] as const,
  allMembers: ["cp", "members-count"] as const,
};

export async function fetchProjects() {
  const { data, error } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}
