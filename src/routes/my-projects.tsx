import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { FileUp, FolderKanban, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { t, useLanguage } from "@/lib/i18n";
import { useRole } from "@/lib/permissions";
import { fmtMoney, fmtPct, STATUSES } from "@/lib/projects";

export const Route = createFileRoute("/my-projects")({
  head: () => ({
    meta: [
      { title: "مشاريعي — Metal Fuze" },
      { name: "description", content: "مساحة مدير المشروع لرفع التقارير والملفات ونسب الإنجاز والمدفوعات لكل مشروع." },
      { property: "og:title", content: "مشاريعي — Metal Fuze" },
      { property: "og:description", content: "تقارير وملفات مشاريع مديري Metal Fuze." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyProjects,
});

type P = Tables<"mgr_projects">;
type R = Tables<"mgr_reports">;
type Kind = "note" | "progress" | "payment" | "file";

function MyProjects() {
  useLanguage();
  const role = useRole();
  const [uid, setUid] = useState<string | null>(null);
  const [projects, setProjects] = useState<P[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    setUid(u.user?.id ?? null);
    const { data } = await supabase.from("mgr_projects").select("*").order("created_at", { ascending: false });
    setProjects(data ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function add() {
    const name = newName.trim();
    if (!name) return;
    const { data: u } = await supabase.auth.getUser();
    const owner_name = (u.user?.user_metadata?.["display_name"] as string) || u.user?.email?.split("@")[0] || "";
    const { error } = await supabase.from("mgr_projects").insert({ name, owner_name });
    if (error) { toast.error(t("تعذر الحفظ، حاول مرة أخرى")); return; }
    setNewName(""); load();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold"><FolderKanban /> {role === "admin" ? t("مشاريع المديرين") : t("مشاريعي")}</h1>
        <p className="text-sm text-muted-foreground">{t("مساحتك منفصلة — لا يراها إلا أنت والإدارة")}</p>
      </div>
      <div className="flex gap-2">
        <Input placeholder={t("اسم المشروع")} value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <Button onClick={add}><Plus /> {t("مشروع جديد")}</Button>
      </div>
      {projects.length === 0 && <p className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">{t("لا توجد مشاريع بعد — أضف مشروعك الأول")}</p>}
      <div className="space-y-3">
        {projects.map((p) => (
          <ProjectCard key={p.id} p={p} mine={p.owner_id === uid} expanded={open === p.id}
            onToggle={() => setOpen(open === p.id ? null : p.id)} reload={load} showOwner={role === "admin"} />
        ))}
      </div>
    </div>
  );
}

function ProjectCard({ p, mine, expanded, onToggle, reload, showOwner }: { p: P; mine: boolean; expanded: boolean; onToggle: () => void; reload: () => void; showOwner: boolean }) {
  const [form, setForm] = useState(p);
  useEffect(() => setForm(p), [p]);
  const remaining = Number(p.contract) - Number(p.paid);

  async function save() {
    const { error } = await supabase.from("mgr_projects").update({
      name: form.name, code: form.code, client: form.client, status: form.status,
      start_date: form.start_date || null, end_date: form.end_date || null,
      contract: Number(form.contract) || 0, issues: form.issues, notes: form.notes, updated_at: new Date().toISOString(),
    }).eq("id", p.id);
    if (error) { toast.error(t("تعذر الحفظ، حاول مرة أخرى")); return; }
    toast.success(t("تم الحفظ")); reload();
  }
  async function remove() {
    if (!confirm(t("حذف المشروع؟"))) return;
    await supabase.from("mgr_projects").delete().eq("id", p.id); reload();
  }
  const set = (k: keyof P, v: string) => setForm({ ...form, [k]: v } as P);

  return (
    <div className="rounded-2xl border border-border bg-card">
      <button onClick={onToggle} className="flex w-full flex-wrap items-center gap-3 p-4 text-start">
        <span className="flex-1 font-bold">{p.name}{showOwner && <span className="ms-2 text-xs font-normal text-muted-foreground">— {p.owner_name}</span>}</span>
        <Badge variant="secondary">{t(p.status)}</Badge>
        <span className="text-sm">{t("نسبة الإنجاز")}: <b>{fmtPct(Number(p.progress))}</b></span>
        <span className="text-sm">{t("المدفوع")}: <b>{fmtMoney(Number(p.paid))}</b> / {fmtMoney(Number(p.contract))}</span>
      </button>
      <div className="mx-4 mb-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${Math.min(100, Number(p.progress) * 100)}%` }} /></div>
      {expanded && (
        <div className="space-y-4 border-t border-border p-4">
          <fieldset disabled={!mine} className="grid gap-2 sm:grid-cols-3">
            <label className="text-xs">{t("اسم المشروع")}<Input value={form.name} onChange={(e) => set("name", e.target.value)} /></label>
            <label className="text-xs">{t("رمز المشروع")}<Input value={form.code} onChange={(e) => set("code", e.target.value)} /></label>
            <label className="text-xs">{t("العميل")}<Input value={form.client} onChange={(e) => set("client", e.target.value)} /></label>
            <label className="text-xs">{t("تاريخ بداية المشروع")}<Input type="date" value={form.start_date ?? ""} onChange={(e) => set("start_date", e.target.value)} /></label>
            <label className="text-xs">{t("تاريخ انتهاء المشروع")}<Input type="date" value={form.end_date ?? ""} onChange={(e) => set("end_date", e.target.value)} /></label>
            <label className="text-xs">{t("حالة المشروع")}
              <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={form.status} onChange={(e) => set("status", e.target.value)}>
                {STATUSES.map((s) => <option key={s} value={s}>{t(s)}</option>)}
              </select>
            </label>
            <label className="text-xs">{t("قيمة العقد")}<Input type="number" value={String(form.contract)} onChange={(e) => set("contract", e.target.value)} /></label>
            <div className="text-xs">{t("المتبقي")}<div className="pt-2 text-base font-bold">{fmtMoney(remaining)}</div></div>
            <div />
            <label className="text-xs sm:col-span-3">{t("الإشكاليات / العوائق")}<Textarea value={form.issues} onChange={(e) => set("issues", e.target.value)} /></label>
            <label className="text-xs sm:col-span-3">{t("ملاحظات مهمة")}<Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} /></label>
          </fieldset>
          {mine && <div className="flex gap-2"><Button onClick={save}>{t("حفظ")}</Button><Button variant="ghost" className="text-destructive" onClick={remove}><Trash2 /> {t("حذف")}</Button></div>}
          <Reports project={p} mine={mine} reload={reload} />
        </div>
      )}
    </div>
  );
}

function Reports({ project, mine, reload }: { project: P; mine: boolean; reload: () => void }) {
  const [list, setList] = useState<R[]>([]);
  const [kind, setKind] = useState<Kind>("note");
  const [body, setBody] = useState("");
  const [value, setValue] = useState("");
  const [direction, setDirection] = useState("in");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("mgr_reports").select("*").eq("project_id", project.id).order("created_at", { ascending: false });
    setList(data ?? []);
  }, [project.id]);
  useEffect(() => { load(); }, [load]);

  async function submit() {
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      let file_path: string | null = null, file_name: string | null = null;
      if (file) {
        file_path = `${u.user!.id}/${project.id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
        const { error } = await supabase.storage.from("project-files").upload(file_path, file);
        if (error) throw error;
        file_name = file.name;
      }
      const num = Number(value) || 0;
      const row = { project_id: project.id, kind, body: body.trim(), file_path, file_name,
        progress: kind === "progress" ? Math.max(0, Math.min(100, num)) / 100 : null,
        amount: kind === "payment" ? num : null, direction: kind === "payment" ? direction : null };
      const { error } = await supabase.from("mgr_reports").insert(row);
      if (error) throw error;
      if (kind === "progress") await supabase.from("mgr_projects").update({ progress: row.progress!, updated_at: new Date().toISOString() }).eq("id", project.id);
      if (kind === "payment" && direction === "in") await supabase.from("mgr_projects").update({ paid: Number(project.paid) + num, updated_at: new Date().toISOString() }).eq("id", project.id);
      setBody(""); setValue(""); setFile(null);
      toast.success(t("تم الحفظ")); load(); reload();
    } catch {
      toast.error(t("تعذر الحفظ، حاول مرة أخرى"));
    } finally { setBusy(false); }
  }

  async function openFile(path: string) {
    const { data } = await supabase.storage.from("project-files").createSignedUrl(path, 300);
    if (data) window.open(data.signedUrl, "_blank");
  }

  const kinds: [Kind, string][] = [["note", "ملاحظة / مشكلة"], ["progress", "تحديث الإنجاز"], ["payment", "دفع / تحصيل"], ["file", "ملف"]];
  return (
    <div className="space-y-3">
      {mine && (
        <div className="space-y-2 rounded-xl bg-muted/50 p-3">
          <h3 className="font-bold">{t("تقرير جديد")}</h3>
          <div className="flex flex-wrap gap-1">
            {kinds.map(([k, l]) => <Button key={k} size="sm" variant={kind === k ? "default" : "outline"} onClick={() => setKind(k)}>{t(l)}</Button>)}
          </div>
          {kind === "progress" && <Input type="number" min={0} max={100} placeholder="%" value={value} onChange={(e) => setValue(e.target.value)} />}
          {kind === "payment" && (
            <div className="flex gap-2">
              <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={direction} onChange={(e) => setDirection(e.target.value)}>
                <option value="in">{t("تحصيل")}</option><option value="out">{t("دفع")}</option>
              </select>
              <Input type="number" placeholder={t("المبلغ")} value={value} onChange={(e) => setValue(e.target.value)} />
            </div>
          )}
          <Textarea placeholder={t("ملاحظات مهمة")} value={body} onChange={(e) => setBody(e.target.value)} />
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <FileUp className="size-4" /> {file ? file.name : t("إرفاق ملف (PDF / Excel / صورة)")}
            <input type="file" className="hidden" accept=".pdf,.xls,.xlsx,.csv,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <Button disabled={busy || (!body.trim() && !file && !value)} onClick={submit}>{t("إرسال التقرير")}</Button>
        </div>
      )}
      <h3 className="font-bold">{t("سجل التقارير")}</h3>
      {list.length === 0 && <p className="text-sm text-muted-foreground">{t("لا توجد تقارير بعد")}</p>}
      {list.map((r) => (
        <div key={r.id} className="rounded-lg border border-border p-3 text-sm">
          <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">{t(kinds.find(([k]) => k === r.kind)?.[1] ?? "ملاحظة / مشكلة")}</Badge>
            {new Date(r.created_at).toLocaleString()}
            {r.progress != null && <b className="text-foreground">{fmtPct(Number(r.progress))}</b>}
            {r.amount != null && <b className="text-foreground">{t(r.direction === "out" ? "دفع" : "تحصيل")}: {fmtMoney(Number(r.amount))}</b>}
          </div>
          {r.body && <p className="whitespace-pre-wrap">{r.body}</p>}
          {r.file_path && <Button size="sm" variant="link" className="px-0" onClick={() => openFile(r.file_path!)}>{t("فتح الملف")}: {r.file_name}</Button>}
        </div>
      ))}
    </div>
  );
}
