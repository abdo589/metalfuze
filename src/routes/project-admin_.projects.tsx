import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { STATUSES, cpKeys, fetchProjects, statusClass, statusLabel } from "@/lib/cp";
import { useLanguage } from "@/lib/i18n";

export const Route = createFileRoute("/project-admin_/projects")({
  head: () => ({
    meta: [
      { title: "قائمة المشاريع — Metal Fuze" },
      { name: "description", content: "بحث وتصفية مشاريع المقاولات حسب الحالة." },
      { property: "og:title", content: "قائمة المشاريع — Metal Fuze" },
      { property: "og:description", content: "بحث وتصفية مشاريع المقاولات حسب الحالة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProjectsList,
});

function ProjectsList() {
  const lang = useLanguage();
  const { data = [], isLoading } = useQuery({ queryKey: cpKeys.projects, queryFn: fetchProjects });
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState(false);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return data.filter((p) => (status === "all" || p.status === status) && (!s || [p.name, p.code, p.client, p.location].some((x) => x.toLowerCase().includes(s))));
  }, [data, q, status]);

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-foreground">المشاريع</h1>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> مشروع جديد</Button>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالاسم أو الكود أو العميل" className="ps-9" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s.v} value={s.v}>{lang === "en" ? s.en : s.ar}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((p) => (
          <Link key={p.id} to="/project-admin/p/$id" params={{ id: p.id }}>
            <Card className="h-full transition hover:border-primary">
              <CardContent className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-foreground">{p.name}</div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs ${statusClass[p.status] ?? ""}`}>{statusLabel(p.status, lang)}</span>
                </div>
                <div className="text-sm text-muted-foreground">{p.code} · {p.client}</div>
                <div className="text-xs text-muted-foreground">{p.location}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      {!isLoading && rows.length === 0 && <p className="text-sm text-muted-foreground">لا توجد نتائج</p>}
      <NewProjectDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

function NewProjectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const lang = useLanguage();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [f, setF] = useState({ name: "", code: "", client: "", location: "", start_date: "", end_date: "", status: "planning", description: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    if (!f.name.trim()) { toast.error("اسم المشروع مطلوب"); return; }
    setBusy(true);
    const { data, error } = await supabase.from("projects").insert({ ...f, start_date: f.start_date || null, end_date: f.end_date || null }).select("id").single();
    setBusy(false);
    if (error) { toast.error("تعذر الحفظ: " + error.message); return; }
    await qc.invalidateQueries({ queryKey: ["cp"] });
    onOpenChange(false);
    navigate({ to: "/project-admin/p/$id", params: { id: data.id } });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>مشروع جديد</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <F label="اسم المشروع"><Input value={f.name} onChange={set("name")} /></F>
          <F label="الكود"><Input value={f.code} onChange={set("code")} /></F>
          <F label="العميل"><Input value={f.client} onChange={set("client")} /></F>
          <F label="الموقع"><Input value={f.location} onChange={set("location")} /></F>
          <F label="تاريخ البداية"><Input type="date" value={f.start_date} onChange={set("start_date")} /></F>
          <F label="تاريخ النهاية"><Input type="date" value={f.end_date} onChange={set("end_date")} /></F>
          <F label="الحالة">
            <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((s) => <SelectItem key={s.v} value={s.v}>{lang === "en" ? s.en : s.ar}</SelectItem>)}</SelectContent>
            </Select>
          </F>
          <div className="sm:col-span-2"><F label="الوصف"><Textarea value={f.description} onChange={set("description")} /></F></div>
        </div>
        <DialogFooter><Button onClick={save} disabled={busy}>حفظ</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
