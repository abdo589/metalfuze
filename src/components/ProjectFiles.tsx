import { useCallback, useEffect, useState } from "react";
import { Download, Eye, FileUp, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { t } from "@/lib/i18n";
import { useRole } from "@/lib/permissions";

const BUCKET = "dashboard-project-files";
export const DEFAULT_FILE_CATEGORIES = ["العقود", "الاعتمادات", "المخططات", "عروض الأسعار"];
type F = Tables<"project_files">;

export function ProjectFiles({ projectId }: { projectId: string }) {
  const canEdit = useRole() === "admin";
  const [files, setFiles] = useState<F[]>([]);
  const [extra, setExtra] = useState<string[]>([]);
  const [newCat, setNewCat] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("project_files").select("*").eq("project_id", projectId).order("created_at");
    setFiles(data ?? []);
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  const cats = [...new Set([...DEFAULT_FILE_CATEGORIES, ...files.map((f) => f.category), ...extra])];

  async function upload(category: string, list: FileList | null) {
    if (!list?.length) return;
    setBusy(category);
    try {
      for (const file of Array.from(list)) {
        const path = `${projectId}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, file);
        if (error) throw error;
        const { error: e2 } = await supabase.from("project_files").insert({ project_id: projectId, category, title: file.name, file_path: path, file_name: file.name });
        if (e2) throw e2;
      }
      toast.success(t("تم الحفظ")); load();
    } catch { toast.error(t("تعذر الحفظ، حاول مرة أخرى")); }
    finally { setBusy(null); }
  }

  async function open(f: F, download: boolean) {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(f.file_path, 60, download ? { download: f.file_name } : undefined);
    if (data) window.open(data.signedUrl, "_blank");
  }

  async function remove(f: F) {
    if (!confirm(t("حذف الملف؟"))) return;
    await supabase.storage.from(BUCKET).remove([f.file_path]);
    await supabase.from("project_files").delete().eq("id", f.id);
    load();
  }

  async function removeCategory(c: string, list: F[]) {
    if (!confirm(list.length ? t("حذف المجلد وكل ملفاته؟") : t("حذف المجلد؟"))) return;
    setBusy(c);
    try {
      if (list.length) {
        await supabase.storage.from(BUCKET).remove(list.map((f) => f.file_path));
        const { error } = await supabase.from("project_files").delete().eq("project_id", projectId).eq("category", c);
        if (error) throw error;
      }
      setExtra((x) => x.filter((n) => n !== c));
      toast.success(t("تم الحذف"));
      load();
    } catch { toast.error(t("تعذر الحذف")); }
    finally { setBusy(null); }
  }

  return (
    <div className="space-y-3 sm:col-span-2">
      <h3 className="font-bold">{t("ملفات المشروع")}</h3>
      {cats.map((c) => {
        const list = files.filter((f) => f.category === c);
        const custom = !DEFAULT_FILE_CATEGORIES.includes(c);
        return (
          <div key={c} className="rounded-lg border border-border bg-muted/30 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">{t(c)} <span className="text-xs text-muted-foreground">({list.length})</span></span>
              <span className="flex items-center gap-2">
                {canEdit && (
                  <label className="flex cursor-pointer items-center gap-1 text-xs text-primary">
                    {busy === c ? <LoaderCircle className="size-4 animate-spin" /> : <FileUp className="size-4" />}{t("رفع ملف")}
                    <input type="file" multiple className="hidden" onChange={(e) => { upload(c, e.target.files); e.target.value = ""; }} />
                  </label>
                )}
                {canEdit && custom && (
                  <Button size="icon" variant="ghost" className="size-7 text-destructive" aria-label={t("حذف المجلد")} onClick={() => removeCategory(c, list)}>
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </span>
            </div>
            {list.length === 0 && <p className="text-xs text-muted-foreground">{t("لا توجد ملفات")}</p>}
            {list.map((f) => (
              <div key={f.id} className="flex items-center gap-1 border-t border-border py-1 text-sm">
                <span className="flex-1 truncate">{f.file_name}</span>
                <Button size="icon" variant="ghost" className="size-7" aria-label={t("عرض")} onClick={() => open(f, false)}><Eye className="size-4" /></Button>
                <Button size="icon" variant="ghost" className="size-7" aria-label={t("تحميل")} onClick={() => open(f, true)}><Download className="size-4" /></Button>
                {canEdit && <Button size="icon" variant="ghost" className="size-7 text-destructive" aria-label={t("حذف")} onClick={() => remove(f)}><Trash2 className="size-4" /></Button>}
              </div>
            ))}
          </div>
        );
      })}
      {canEdit && (
        <div className="flex gap-2">
          <Input placeholder={t("اسم ملف جديد")} value={newCat} onChange={(e) => setNewCat(e.target.value)} />
          <Button variant="outline" onClick={() => { const n = newCat.trim(); if (n) { setExtra((x) => [...x, n]); setNewCat(""); } }}><Plus />{t("إضافة")}</Button>
        </div>
      )}
    </div>
  );
}
