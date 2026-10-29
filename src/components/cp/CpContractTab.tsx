import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cpKeys, type CpContract } from "@/lib/cp";
import { Fld } from "./CpOverview";

type FileKey = "contract_file" | "specs_file" | "tender_drawings_file";
const FILES: { k: FileKey; l: string }[] = [
  { k: "contract_file", l: "العقد" },
  { k: "specs_file", l: "المواصفات" },
  { k: "tender_drawings_file", l: "مخططات المناقصة" },
];

const empty = (projectId: string): CpContract => ({
  project_id: projectId, contract_no: "", value: 0, signed_date: null, duration_days: null, consultant: "", pmo: "",
  contract_file: null, specs_file: null, tender_drawings_file: null, updated_at: "",
});

export function CpContractTab({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: cpKeys.contract(projectId),
    queryFn: async () => {
      const { data, error } = await supabase.from("project_contracts").select("*").eq("project_id", projectId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const [f, setF] = useState<CpContract>(empty(projectId));
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { setF(data ?? empty(projectId)); }, [data, projectId]);

  const persist = async (next: CpContract) => {
    const { updated_at: _u, ...row } = next;
    const { error } = await supabase.from("project_contracts").upsert({ ...row, updated_at: new Date().toISOString() });
    if (error) { toast.error("تعذر الحفظ: " + error.message); return false; }
    qc.invalidateQueries({ queryKey: cpKeys.contract(projectId) });
    return true;
  };
  const save = async () => { if (await persist(f)) toast.success("تم حفظ العقد"); };

  const upload = async (k: FileKey, file: File) => {
    setBusy(k);
    const path = `${projectId}/${k}-${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
    const { error } = await supabase.storage.from("contract-files").upload(path, file);
    if (error) { setBusy(null); { toast.error("تعذر الرفع: " + error.message); return; } }
    const next = { ...f, [k]: path };
    setF(next);
    if (await persist(next)) toast.success("تم رفع الملف");
    setBusy(null);
  };
  const open = async (path: string) => {
    const { data, error } = await supabase.storage.from("contract-files").createSignedUrl(path, 10);
    if (error || !data) { toast.error("تعذر فتح الملف"); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  if (isLoading) return <p className="p-4 text-muted-foreground">…</p>;
  return (
    <div className="space-y-4">
      <Card><CardContent className="grid gap-3 p-5 sm:grid-cols-2">
        <Fld l="رقم العقد"><Input value={f.contract_no} onChange={(e) => setF({ ...f, contract_no: e.target.value })} /></Fld>
        <Fld l="قيمة العقد (ر.س)"><Input type="number" inputMode="decimal" value={f.value} onChange={(e) => setF({ ...f, value: Number(e.target.value) || 0 })} /></Fld>
        <Fld l="تاريخ التوقيع"><Input type="date" value={f.signed_date ?? ""} onChange={(e) => setF({ ...f, signed_date: e.target.value || null })} /></Fld>
        <Fld l="المدة (يوم)"><Input type="number" inputMode="numeric" value={f.duration_days ?? ""} onChange={(e) => setF({ ...f, duration_days: e.target.value ? Number(e.target.value) : null })} /></Fld>
        <Fld l="الاستشاري"><Input value={f.consultant} onChange={(e) => setF({ ...f, consultant: e.target.value })} /></Fld>
        <Fld l="مكتب إدارة المشاريع PMO"><Input value={f.pmo} onChange={(e) => setF({ ...f, pmo: e.target.value })} /></Fld>
        <div className="sm:col-span-2"><Button onClick={save}>حفظ العقد</Button></div>
      </CardContent></Card>
      <Card>
        <CardHeader><CardTitle className="text-base">المرفقات</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          {FILES.map(({ k, l }) => (
            <div key={k} className="space-y-2 rounded-lg border border-border p-3">
              <div className="font-medium text-foreground">{l}</div>
              {f[k] ? (
                <Button variant="outline" size="sm" className="w-full" onClick={() => open(f[k]!)}><FileText className="h-4 w-4" /> فتح الملف</Button>
              ) : <div className="text-xs text-muted-foreground">لا يوجد ملف</div>}
              <label className="flex cursor-pointer items-center justify-center gap-1 rounded-md bg-secondary px-3 py-1.5 text-sm text-secondary-foreground hover:bg-secondary/80">
                <Upload className="h-4 w-4" /> {busy === k ? "جارٍ الرفع…" : f[k] ? "استبدال" : "رفع"}
                <input type="file" className="hidden" disabled={busy !== null} onChange={(e) => { const file = e.target.files?.[0]; if (file) upload(k, file); e.target.value = ""; }} />
              </label>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
