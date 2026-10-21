import { useCallback, useEffect, useState } from "react";
import { Download, Eye, FileUp, LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { t } from "@/lib/i18n";
import { useRole } from "@/lib/permissions";

const BUCKET = "dashboard-project-files";
const PHOTOS = "صور المشروع";
export const DEFAULT_FILE_CATEGORIES = ["العقود", "الاعتمادات", "المخططات", "عروض الأسعار", PHOTOS];
type F = Tables<"project_files">;

function Thumb({ path, alt, onClick }: { path: string; alt: string; onClick: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    supabase.storage.from(BUCKET).createSignedUrl(path, 3600).then(({ data }) => setUrl(data?.signedUrl ?? null));
  }, [path]);
  return (
    <button type="button" onClick={onClick} className="block aspect-square w-full bg-muted" aria-label={alt}>
      {url ? <img src={url} alt={alt} loading="lazy" className="size-full object-cover" /> : <LoaderCircle className="m-auto size-4 animate-spin" />}
    </button>
  );
}

export function ProjectFiles({ projectId, editable, defaults = DEFAULT_FILE_CATEGORIES, title = "ملفات المشروع" }: { projectId: string; editable?: boolean; defaults?: string[]; title?: string }) {
  const role = useRole();
  const canEdit = editable ?? role === "admin";
  const DEFAULT_FILE_CATEGORIES = defaults;
  const [all, setAll] = useState<F[]>([]);
  // Empty folders are kept as a marker row (file_path "") so they persist until deleted.
  const files = all.filter((f) => f.file_path);
  const [extra, setExtra] = useState<string[]>([]);
  const [newCat, setNewCat] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("project_files").select("*").eq("project_id", projectId).order("created_at");
    setAll(data ?? []);
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  const HID = "__hidden__:";
  const hidden = new Set(all.filter((f) => f.category.startsWith(HID)).map((f) => f.category.slice(HID.length)));
  const cats = [...new Set([...DEFAULT_FILE_CATEGORIES, ...all.map((f) => f.category), ...extra])].filter((c) => !c.startsWith(HID) && !hidden.has(c));
  const marker = (category: string) => supabase.from("project_files").insert({ project_id: projectId, category, title: "", file_path: "", file_name: "" });

  async function renameCategory(c: string) {
    const n = prompt(t("الاسم الجديد"), t(c))?.trim();
    if (!n || n === c) return;
    setBusy(c);
    try {
      const { error } = await supabase.from("project_files").update({ category: n }).eq("project_id", projectId).eq("category", c);
      if (error) throw error;
      if (!all.some((f) => f.category === c)) await marker(n);
      if (DEFAULT_FILE_CATEGORIES.includes(c)) await marker(HID + c);
      setExtra((x) => x.map((v) => (v === c ? n : v)));
      toast.success(t("تم الحفظ")); load();
    } catch { toast.error(t("تعذر الحفظ، حاول مرة أخرى")); }
    finally { setBusy(null); }
  }

  async function renameFile(f: F) {
    const n = prompt(t("الاسم الجديد"), f.file_name)?.trim();
    if (!n || n === f.file_name) return;
    const { error } = await supabase.from("project_files").update({ file_name: n, title: n }).eq("id", f.id);
    if (error) toast.error(t("تعذر الحفظ، حاول مرة أخرى")); else load();
  }

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
      if (list.length) await supabase.storage.from(BUCKET).remove(list.map((f) => f.file_path));
      {
        const { error } = await supabase.from("project_files").delete().eq("project_id", projectId).eq("category", c);
        if (error) throw error;
      }
      if (DEFAULT_FILE_CATEGORIES.includes(c)) await marker(HID + c);
      setExtra((x) => x.filter((n) => n !== c));
      toast.success(t("تم الحذف"));
      load();
    } catch { toast.error(t("تعذر الحذف")); }
    finally { setBusy(null); }
  }

  return (
    <div className="space-y-3 sm:col-span-2">
      <h3 className="font-bold">{t(title)}</h3>
      {cats.map((c) => {
        const list = files.filter((f) => f.category === c);
        return (
          <div key={c} className="rounded-lg border border-border bg-muted/30 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">{t(c)} <span className="text-xs text-muted-foreground">({list.length})</span></span>
              <span className="flex items-center gap-2">
                {canEdit && (
                  <label className="flex cursor-pointer items-center gap-1 text-xs text-primary">
                    {busy === c ? <LoaderCircle className="size-4 animate-spin" /> : <FileUp className="size-4" />}{t("رفع ملف")}
                    <input type="file" multiple accept={c === PHOTOS ? "image/*" : undefined} className="hidden" onChange={(e) => { upload(c, e.target.files); e.target.value = ""; }} />
                  </label>
                )}
                {canEdit && (
                  <Button size="icon" variant="ghost" className="size-7" aria-label={t("تعديل")} onClick={() => renameCategory(c)}>
                    <Pencil className="size-4" />
                  </Button>
                )}
                {canEdit && (
                  <Button size="icon" variant="ghost" className="size-7 text-destructive" aria-label={t("حذف المجلد")} onClick={() => removeCategory(c, list)}>
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </span>
            </div>
            {list.length === 0 && <p className="text-xs text-muted-foreground">{t("لا توجد ملفات")}</p>}
            {c === PHOTOS || list.some((f) => /\.(jpe?g|png|gif|webp|heic)$/i.test(f.file_path)) ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {list.map((f) => (
                  <div key={f.id} className="group relative overflow-hidden rounded-md border border-border bg-background">
                    <Thumb path={f.file_path} alt={f.file_name} onClick={() => open(f, false)} />
                    <div className="flex justify-center gap-1 p-1">
                      <Button size="icon" variant="ghost" className="size-7" aria-label={t("تحميل")} onClick={() => open(f, true)}><Download className="size-4" /></Button>
                      {canEdit && <Button size="icon" variant="ghost" className="size-7" aria-label={t("تعديل")} onClick={() => renameFile(f)}><Pencil className="size-4" /></Button>}
                {canEdit && <Button size="icon" variant="ghost" className="size-7 text-destructive" aria-label={t("حذف")} onClick={() => remove(f)}><Trash2 className="size-4" /></Button>}
                    </div>
                  </div>
                ))}
              </div>
            ) : list.map((f) => (
              <div key={f.id} className="flex items-center gap-1 border-t border-border py-1 text-sm">
                <span className="flex-1 truncate">{f.file_name}</span>
                <Button size="icon" variant="ghost" className="size-7" aria-label={t("عرض")} onClick={() => open(f, false)}><Eye className="size-4" /></Button>
                <Button size="icon" variant="ghost" className="size-7" aria-label={t("تحميل")} onClick={() => open(f, true)}><Download className="size-4" /></Button>
                {canEdit && <Button size="icon" variant="ghost" className="size-7" aria-label={t("تعديل")} onClick={() => renameFile(f)}><Pencil className="size-4" /></Button>}
                {canEdit && <Button size="icon" variant="ghost" className="size-7 text-destructive" aria-label={t("حذف")} onClick={() => remove(f)}><Trash2 className="size-4" /></Button>}
              </div>
            ))}
          </div>
        );
      })}
      {canEdit && (
        <div className="flex gap-2">
          <Input placeholder={t("اسم ملف جديد")} value={newCat} onChange={(e) => setNewCat(e.target.value)} />
          <Button variant="outline" onClick={() => { const n = newCat.trim(); if (n) { setExtra((x) => [...x, n]); setNewCat(""); supabase.from("project_files").insert({ project_id: projectId, category: n, title: "", file_path: "", file_name: "" }).then(({ error }) => { if (error) toast.error(t("تعذر الحفظ، حاول مرة أخرى")); else load(); }); } }}><Plus />{t("إضافة")}</Button>
        </div>
      )}
    </div>
  );
}
