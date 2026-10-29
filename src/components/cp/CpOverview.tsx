import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STATUSES, statusLabel, type CpProject } from "@/lib/cp";
import { useLanguage } from "@/lib/i18n";

export function CpOverview({ project }: { project: CpProject }) {
  const lang = useLanguage();
  const qc = useQueryClient();
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState(project);
  const set = (k: keyof CpProject) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    const { error } = await supabase.from("projects").update({
      name: f.name, code: f.code, client: f.client, location: f.location, status: f.status, description: f.description,
      start_date: f.start_date || null, end_date: f.end_date || null, updated_at: new Date().toISOString(),
    }).eq("id", project.id);
    if (error) return toast.error("تعذر الحفظ: " + error.message);
    toast.success("تم الحفظ");
    setEdit(false);
    qc.invalidateQueries({ queryKey: ["cp"] });
  };

  if (!edit) {
    const rows: [string, string][] = [
      ["الكود", project.code], ["العميل", project.client], ["الموقع", project.location],
      ["تاريخ البداية", project.start_date ?? "—"], ["تاريخ النهاية", project.end_date ?? "—"], ["الحالة", statusLabel(project.status, lang)],
    ];
    return (
      <Card><CardContent className="space-y-4 p-5">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map(([k, v]) => <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-medium text-foreground">{v || "—"}</dd></div>)}
        </dl>
        <div><div className="text-xs text-muted-foreground">الوصف</div><p className="whitespace-pre-wrap text-foreground">{project.description || "—"}</p></div>
        <Button variant="outline" onClick={() => { setF(project); setEdit(true); }}>تعديل</Button>
      </CardContent></Card>
    );
  }
  return (
    <Card><CardContent className="grid gap-3 p-5 sm:grid-cols-2">
      <Fld l="اسم المشروع"><Input value={f.name} onChange={set("name")} /></Fld>
      <Fld l="الكود"><Input value={f.code} onChange={set("code")} /></Fld>
      <Fld l="العميل"><Input value={f.client} onChange={set("client")} /></Fld>
      <Fld l="الموقع"><Input value={f.location} onChange={set("location")} /></Fld>
      <Fld l="تاريخ البداية"><Input type="date" value={f.start_date ?? ""} onChange={set("start_date")} /></Fld>
      <Fld l="تاريخ النهاية"><Input type="date" value={f.end_date ?? ""} onChange={set("end_date")} /></Fld>
      <Fld l="الحالة">
        <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{STATUSES.map((s) => <SelectItem key={s.v} value={s.v}>{lang === "en" ? s.en : s.ar}</SelectItem>)}</SelectContent>
        </Select>
      </Fld>
      <div className="sm:col-span-2"><Fld l="الوصف"><Textarea value={f.description} onChange={set("description")} /></Fld></div>
      <div className="flex gap-2 sm:col-span-2"><Button onClick={save}>حفظ</Button><Button variant="ghost" onClick={() => setEdit(false)}>إلغاء</Button></div>
    </CardContent></Card>
  );
}

export function Fld({ l, children }: { l: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{l}</Label>{children}</div>;
}
