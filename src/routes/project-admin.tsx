import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FolderKanban, Users, HardHat } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cpKeys, fetchProjects, statusClass, statusLabel } from "@/lib/cp";
import { useLanguage } from "@/lib/i18n";

export const Route = createFileRoute("/project-admin")({
  head: () => ({
    meta: [
      { title: "إدارة مشاريع — Metal Fuze" },
      { name: "description", content: "لوحة تحكم إدارة مشاريع المقاولات في Metal Fuze." },
      { property: "og:title", content: "إدارة مشاريع — Metal Fuze" },
      { property: "og:description", content: "لوحة تحكم إدارة مشاريع المقاولات في Metal Fuze." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProjectAdminDashboard,
});

function ProjectAdminDashboard() {
  const lang = useLanguage();
  const projects = useQuery({ queryKey: cpKeys.projects, queryFn: fetchProjects });
  const members = useQuery({
    queryKey: cpKeys.allMembers,
    queryFn: async () => {
      const { count, error } = await supabase.from("project_members").select("id", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });
  const list = projects.data ?? [];
  const active = list.filter((p) => p.status === "active").length;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-foreground">إدارة مشاريع</h1>
        <Button asChild><Link to="/project-admin/projects">كل المشاريع</Link></Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon={<HardHat className="h-5 w-5" />} label="مشاريع جارية" value={projects.isLoading ? "…" : active} />
        <Stat icon={<FolderKanban className="h-5 w-5" />} label="إجمالي المشاريع" value={projects.isLoading ? "…" : list.length} />
        <Stat icon={<Users className="h-5 w-5" />} label="أعضاء الفريق" value={members.isLoading ? "…" : (members.data ?? 0)} />
      </div>
      <Card>
        <CardHeader><CardTitle>آخر المشاريع</CardTitle></CardHeader>
        <CardContent className="divide-y divide-border p-0">
          {list.slice(0, 5).map((p) => (
            <Link key={p.id} to="/project-admin/p/$id" params={{ id: p.id }} className="flex items-center justify-between gap-3 px-6 py-3 hover:bg-muted/50">
              <div className="min-w-0">
                <div className="truncate font-medium text-foreground">{p.name}</div>
                <div className="truncate text-xs text-muted-foreground">{p.code} · {p.client}</div>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs ${statusClass[p.status] ?? ""}`}>{statusLabel(p.status, lang)}</span>
            </Link>
          ))}
          {!projects.isLoading && list.length === 0 && <p className="px-6 py-6 text-sm text-muted-foreground">لا توجد مشاريع بعد</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="rounded-lg bg-primary/10 p-3 text-primary">{icon}</div>
        <div>
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="text-2xl font-bold text-foreground">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}
