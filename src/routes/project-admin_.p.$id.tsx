import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cpKeys, statusClass, statusLabel } from "@/lib/cp";
import { useLanguage } from "@/lib/i18n";
import { CpOverview } from "@/components/cp/CpOverview";
import { CpContractTab } from "@/components/cp/CpContractTab";
import { CpTeamTab } from "@/components/cp/CpTeamTab";
import { CpSubmissionsTab } from "@/components/cp/CpSubmissionsTab";
import { CpInvoicesTab } from "@/components/cp/CpInvoicesTab";
import { CpScheduleTab } from "@/components/cp/CpScheduleTab";
import { CpReportsTab } from "@/components/cp/CpReportsTab";

export const Route = createFileRoute("/project-admin_/p/$id")({
  head: () => ({
    meta: [
      { title: "تفاصيل المشروع — Metal Fuze" },
      { name: "description", content: "نظرة عامة وعقد وفريق عمل مشروع المقاولات." },
      { property: "og:title", content: "تفاصيل المشروع — Metal Fuze" },
      { property: "og:description", content: "نظرة عامة وعقد وفريق عمل مشروع المقاولات." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProjectDetails,
});



function ProjectDetails() {
  const { id } = Route.useParams();
  const lang = useLanguage();
  const { data: p, isLoading } = useQuery({
    queryKey: cpKeys.project(id),
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  if (isLoading) return <div className="p-6 text-muted-foreground">…</div>;
  if (!p) return <div className="p-6 text-muted-foreground">المشروع غير موجود أو ليس لديك صلاحية</div>;

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
      <Link to="/project-admin/projects" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="h-4 w-4 ltr:rotate-180" /> المشاريع
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-foreground">{p.name}</h1>
        <span className={`rounded-full px-2.5 py-0.5 text-xs ${statusClass[p.status] ?? ""}`}>{statusLabel(p.status, lang)}</span>
      </div>
      <Tabs defaultValue="overview">
        <div className="overflow-x-auto">
          <TabsList className="w-max">
            <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
            <TabsTrigger value="contract">العقد</TabsTrigger>
            <TabsTrigger value="team">فريق العمل</TabsTrigger>
            <TabsTrigger value="docs">المستندات</TabsTrigger>
            <TabsTrigger value="wirs">طلبات الاستلام WIRs</TabsTrigger>
            <TabsTrigger value="ipc">المستخلصات</TabsTrigger>
            <TabsTrigger value="planning">التخطيط</TabsTrigger>
            <TabsTrigger value="reports">التقارير</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="overview"><CpOverview project={p} /></TabsContent>
        <TabsContent value="contract"><CpContractTab projectId={p.id} /></TabsContent>
        <TabsContent value="team"><CpTeamTab projectId={p.id} /></TabsContent>
        <TabsContent value="docs"><CpSubmissionsTab projectId={p.id} types={["MIR", "SUB", "SD", "OTHER"]} /></TabsContent>
        <TabsContent value="ipc"><CpInvoicesTab projectId={p.id} /></TabsContent>
        <TabsContent value="wirs"><CpSubmissionsTab projectId={p.id} types={["WIR"]} /></TabsContent>
        <TabsContent value="planning"><CpScheduleTab projectId={p.id} /></TabsContent>
        <TabsContent value="reports"><CpReportsTab projectId={p.id} projectName={p.name} /></TabsContent>
      </Tabs>
    </div>
  );
}
