import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listEmployees from "./tools/list-employees";
import listLeaveRequests from "./tools/list-leave-requests";
import expiringDocuments from "./tools/expiring-documents";
import listManagerProjects from "./tools/list-manager-projects";

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "metalfuze",
  title: "Metalfuze",
  version: "0.1.0",
  instructions: "Read-only Metalfuze HR and project tools: employees, leave requests, expiring residency/permit documents, and project-manager projects. Results follow the signed-in user's permissions.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listEmployees, listLeaveRequests, expiringDocuments, listManagerProjects],
});
