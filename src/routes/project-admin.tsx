import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FolderKanban, Users, HardHat } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { invLate, invPending, sar, CODES, codeColorVar, cpKeys, fetchProjects, isOverdue, isPending, latestRevisions, statusClass, statusLabel } from "@/lib/cp";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FileClock, AlarmClock, Wallet } from "lucide-react";
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
  const subs = useQuery({
    queryKey: ["cp", "subs-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("submissions").select("id,parent_id,revision,status,code,reply_date,submitted_date");
      if (error) throw error;
      return latestRevisions(data as never);
    },
  });
  const latest = subs.data ?? [];
  const pending = latest.filter(isPending).length;
  const overdue = latest.filter((s) => isOverdue(s)).length;
  const codeData = CODES.map((c) => ({ code: c.v, label: lang === "en" ? c.en : c.ar, count: latest.filter((s) => s.code === c.v).length }));
  const invs = useQuery({
    queryKey: ["cp", "invoices-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("invoices").select("id,status,submitted_date,net_amount");
      if (error) throw error;
      return data;
    },
  });
  const invPendingSum = (invs.data ?? []).filter(invPending).reduce((s, i) => s + Number(i.net_amount ?? 0), 0);
  const invLateCount = (invs.data ?? []).filter((i) => invLate(i)).length;
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
      <div className="grid gap-4 sm:grid-cols-2">
        <Stat icon={<FileClock className="h-5 w-5" />} label="مستندات معلقة" value={subs.isLoading ? "…" : pending} />
        <Stat icon={<AlarmClock className="h-5 w-5" />} label="مستندات متأخرة (أكثر من 7 أيام)" value={subs.isLoading ? "…" : overdue} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Stat icon={<Wallet className="h-5 w-5" />} label="مستخلصات معلقة (صافي)" value={invs.isLoading ? "…" : sar(invPendingSum, lang)} />
        <Stat icon={<AlarmClock className="h-5 w-5" />} label="مستخلصات أكثر من 30 يوم بدون صرف" value={invs.isLoading ? "…" : invLateCount} />
      </div>
      <Card>
        <CardHeader><CardTitle>توزيع أكواد الاعتماد</CardTitle></CardHeader>
        <CardContent className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={codeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="code" stroke="var(--muted-foreground)" />
              <YAxis allowDecimals={false} stroke="var(--muted-foreground)" width={30} />
              <Tooltip formatter={(v) => [v, ""]} labelFormatter={(l) => `${l} · ${codeData.find((d) => d.code === l)?.label ?? ""}`} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", color: "var(--popover-foreground)" }} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>{codeData.map((d) => <Cell key={d.code} fill={codeColorVar[d.code]} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
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
