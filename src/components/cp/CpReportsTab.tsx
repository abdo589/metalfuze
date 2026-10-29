import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImagePlus, Plus, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PdfButton } from "@/components/PdfButton";
import {
  CODES, INV_STATUSES, SUB_STATUSES, TRADES, WEATHER, iso, monthOf, periodReport, pick, sar, weekOf,
  type CpAttachment, type CpDaily,
} from "@/lib/cp";
import { useLanguage } from "@/lib/i18n";
import { Fld } from "./CpOverview";
import { CodeBadge, subKey } from "./CpSubmissionsTab";
import { actKey, fetchActs, Stat } from "./CpScheduleTab";

const dailyKey = (p: string) => ["cp", "daily", p] as const;

export function CpReportsTab({ projectId, projectName }: { projectId: string; projectName: string }) {
  return (
    <Tabs defaultValue="daily">
      <TabsList><TabsTrigger value="daily">التقرير اليومي</TabsTrigger><TabsTrigger value="week">أسبوعي</TabsTrigger><TabsTrigger value="month">شهري</TabsTrigger></TabsList>
      <TabsContent value="daily"><DailyList projectId={projectId} projectName={projectName} /></TabsContent>
      <TabsContent value="week"><PeriodView projectId={projectId} projectName={projectName} kind="week" /></TabsContent>
      <TabsContent value="month"><PeriodView projectId={projectId} projectName={projectName} kind="month" /></TabsContent>
    </Tabs>
  );
}

function useDaily(projectId: string) {
  return useQuery({
    queryKey: dailyKey(projectId),
    queryFn: async () => {
      const { data, error } = await supabase.from("daily_reports").select("*").eq("project_id", projectId).order("report_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

function usePhotoUrls(photos: CpAttachment[]) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const key = photos.map((p) => p.path).join("|");
  useEffect(() => {
    if (!photos.length) return;
    supabase.storage.from("contract-files").createSignedUrls(photos.map((p) => p.path), 60).then(({ data }) => {
      const m: Record<string, string> = {};
      data?.forEach((d) => { if (d.path && d.signedUrl) m[d.path] = d.signedUrl; });
      setUrls(m);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return urls;
}

const mp = (r: CpDaily) => (r.manpower ?? {}) as Record<string, number>;
const photosOf = (r: CpDaily) => (r.photos ?? []) as CpAttachment[];

function DailyList({ projectId, projectName }: { projectId: string; projectName: string }) {
  const qc = useQueryClient();
  const { data: list = [] } = useDaily(projectId);
  const { data: canWrite = false } = useQuery({
    queryKey: ["cp", "can-daily", projectId],
    queryFn: async () => { const { data } = await supabase.rpc("cp_can_daily", { _project: projectId }); return !!data; },
  });
  const [open, setOpen] = useState<Partial<CpDaily> | null>(null);
  const [view, setView] = useState<CpDaily | null>(null);
  return (
    <div className="space-y-3">
      {canWrite && <Button onClick={() => setOpen({ report_date: iso(Date.now()), weather: "مشمس", manpower: {}, photos: [] })}><Plus className="h-4 w-4" /> تقرير اليوم</Button>}
      {list.length === 0 && <Card><CardContent className="py-10 text-center text-muted-foreground">لا توجد تقارير يومية بعد</CardContent></Card>}
      <div className="grid gap-3 md:grid-cols-2">
        {list.map((r) => (
          <Card key={r.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setView(r)}>
            <CardContent className="space-y-1 p-4 text-sm">
              <div className="flex justify-between"><b className="text-foreground">{r.report_date}</b><span className="text-muted-foreground">{r.weather}</span></div>
              <div className="text-muted-foreground">العمالة: {Object.values(mp(r)).reduce((a, b) => a + Number(b), 0)} · صور: {photosOf(r).length}</div>
              <div className="line-clamp-2 text-foreground">{r.work_done}</div>
              {r.issues && <div className="line-clamp-1 text-destructive">مشاكل: {r.issues}</div>}
            </CardContent>
          </Card>
        ))}
      </div>
      {open && <DailyDialog projectId={projectId} draft={open} onClose={() => setOpen(null)} onSaved={() => { qc.invalidateQueries({ queryKey: dailyKey(projectId) }); setOpen(null); }} />}
      {view && <DailyView r={view} projectName={projectName} canEdit={canWrite} onEdit={() => { setOpen(view); setView(null); }} onClose={() => setView(null)} />}
    </div>
  );
}

function DailyView({ r, projectName, canEdit, onEdit, onClose }: { r: CpDaily; projectName: string; canEdit: boolean; onEdit: () => void; onClose: () => void }) {
  const urls = usePhotoUrls(photosOf(r));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>التقرير اليومي — {r.report_date}</DialogTitle></DialogHeader>
        <div className="flex flex-wrap gap-2">
          <PdfButton /><Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" /> طباعة</Button>
          {canEdit && <Button variant="outline" onClick={onEdit}>تعديل</Button>}
        </div>
        <div data-report-document className="space-y-3 bg-background p-4 text-sm text-foreground">
          <ReportHead title="التقرير اليومي" projectName={projectName} sub={r.report_date} />
          <div className="grid grid-cols-2 gap-2"><div><b>الطقس:</b> {r.weather || "—"}</div><div><b>أعدّه:</b> {r.created_by_name || "—"}</div></div>
          <Table><TableHeader><TableRow><TableHead>التخصص</TableHead><TableHead>عدد العمالة</TableHead></TableRow></TableHeader>
            <TableBody>{Object.entries(mp(r)).map(([k, v]) => <TableRow key={k}><TableCell>{k}</TableCell><TableCell>{v}</TableCell></TableRow>)}</TableBody></Table>
          <Sec t="الأعمال المنفذة">{r.work_done || "—"}</Sec>
          <Sec t="المشاكل">{r.issues || "لا يوجد"}</Sec>
          {photosOf(r).length > 0 && <div className="grid grid-cols-3 gap-2">{photosOf(r).map((p) => urls[p.path] ? <img key={p.path} src={urls[p.path]} crossOrigin="anonymous" alt={p.name} className="aspect-video w-full rounded object-cover" /> : <div key={p.path} className="aspect-video rounded bg-muted" />)}</div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DailyDialog({ projectId, draft, onClose, onSaved }: { projectId: string; draft: Partial<CpDaily>; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState(draft);
  const [busy, setBusy] = useState(false);
  const man = (d.manpower ?? {}) as Record<string, number>;
  const photos = (d.photos ?? []) as CpAttachment[];
  const urls = usePhotoUrls(photos);
  const upload = async (files: FileList) => {
    setBusy(true);
    const added: CpAttachment[] = [];
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("image/")) continue;
      const path = `${projectId}/daily/${crypto.randomUUID()}-${f.name.replace(/[^\w.-]/g, "_")}`;
      const { error } = await supabase.storage.from("contract-files").upload(path, f);
      if (error) { toast.error(error.message); continue; }
      added.push({ path, name: f.name });
    }
    setD((p) => ({ ...p, photos: [...photos, ...added] }));
    setBusy(false);
  };
  const save = async () => {
    if (!d.report_date) { toast.error("اختر التاريخ"); return; }
    setBusy(true);
    const clean = Object.fromEntries(Object.entries(man).filter(([, v]) => Number(v) > 0).map(([k, v]) => [k, Number(v)]));
    const row = { report_date: d.report_date, weather: d.weather ?? "", manpower: clean, work_done: d.work_done ?? "", issues: d.issues ?? "", photos };
    const { error } = d.id
      ? await supabase.from("daily_reports").update(row).eq("id", d.id)
      : await supabase.from("daily_reports").insert({ ...row, project_id: projectId });
    setBusy(false);
    if (error) { toast.error(error.code === "23505" ? "يوجد تقرير لهذا اليوم بالفعل" : error.message); return; }
    toast.success("تم حفظ التقرير"); onSaved();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle>{d.id ? "تعديل التقرير اليومي" : "تقرير يومي جديد"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Fld l="التاريخ"><Input type="date" value={d.report_date ?? ""} onChange={(e) => setD({ ...d, report_date: e.target.value })} /></Fld>
            <Fld l="الطقس">
              <Select value={d.weather ?? ""} onValueChange={(v) => setD({ ...d, weather: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{WEATHER.map((w) => <SelectItem key={w} value={w}>{w}</SelectItem>)}</SelectContent>
              </Select>
            </Fld>
          </div>
          <Fld l="عدد العمالة لكل تخصص">
            <div className="grid grid-cols-2 gap-2">
              {TRADES.map((t) => (
                <label key={t} className="flex items-center gap-2 text-sm"><span className="w-24 shrink-0">{t}</span>
                  <Input type="number" min={0} inputMode="numeric" value={man[t] ?? ""} onChange={(e) => setD({ ...d, manpower: { ...man, [t]: Number(e.target.value) } })} /></label>
              ))}
            </div>
          </Fld>
          <Fld l="الأعمال المنفذة اليوم"><Textarea rows={3} value={d.work_done ?? ""} onChange={(e) => setD({ ...d, work_done: e.target.value })} /></Fld>
          <Fld l="المشاكل"><Textarea rows={2} value={d.issues ?? ""} onChange={(e) => setD({ ...d, issues: e.target.value })} /></Fld>
          <Fld l="صور من الموقع">
            <div className="flex flex-wrap gap-2">
              {photos.map((p) => (
                <div key={p.path} className="relative">
                  {urls[p.path] ? <img src={urls[p.path]} alt={p.name} className="h-16 w-20 rounded object-cover" /> : <div className="h-16 w-20 rounded bg-muted" />}
                  <button type="button" className="absolute -top-1 end-0 rounded-full bg-destructive px-1.5 text-xs text-destructive-foreground" onClick={() => setD({ ...d, photos: photos.filter((x) => x.path !== p.path) })}>×</button>
                </div>
              ))}
              <label className="flex h-16 w-20 cursor-pointer items-center justify-center rounded border border-dashed border-border text-muted-foreground">
                <ImagePlus className="h-5 w-5" />
                <input type="file" accept="image/*" capture="environment" multiple className="hidden" disabled={busy} onChange={(e) => { if (e.target.files) upload(e.target.files); e.target.value = ""; }} />
              </label>
            </div>
          </Fld>
        </div>
        <DialogFooter><Button disabled={busy} onClick={save}>حفظ</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PeriodView({ projectId, projectName, kind }: { projectId: string; projectName: string; kind: "week" | "month" }) {
  const lang = useLanguage();
  const [at, setAt] = useState(iso(Date.now()));
  const { data: daily = [] } = useDaily(projectId);
  const { data: acts = [] } = useQuery({ queryKey: actKey(projectId), queryFn: () => fetchActs(projectId) });
  const { data: subs = [] } = useQuery({
    queryKey: subKey(projectId),
    queryFn: async () => { const { data, error } = await supabase.from("submissions").select("*").eq("project_id", projectId).order("created_at"); if (error) throw error; return data; },
  });
  const { data: invoices = [] } = useQuery({
    queryKey: ["cp", "invoices", projectId],
    queryFn: async () => { const { data, error } = await supabase.from("invoices").select("*").eq("project_id", projectId).order("invoice_no"); if (error) throw error; return data; },
  });
  const range = kind === "week" ? weekOf(at) : monthOf(at);
  const r = useMemo(() => periodReport({ daily, subs, invoices, acts }, range.from, range.to), [daily, subs, invoices, acts, range.from, range.to]);
  const title = kind === "week" ? "التقرير الأسبوعي" : "التقرير الشهري";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <Fld l={kind === "week" ? "أي يوم في الأسبوع" : "أي يوم في الشهر"}><Input type="date" value={at} onChange={(e) => e.target.value && setAt(e.target.value)} className="w-44" /></Fld>
        <PdfButton /><Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" /> طباعة</Button>
      </div>
      <div data-report-document className="space-y-4 bg-background p-4 text-sm text-foreground">
        <ReportHead title={title} projectName={projectName} sub={`${r.from} — ${r.to}`} />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat l="الإنجاز الفعلي" v={`${r.actual}%`} />
          <Stat l="المخطط حتى نهاية الفترة" v={`${r.planned}%`} />
          <Stat l="أيام مُبلغ عنها" v={String(r.daily.length)} />
          <Stat l="إجمالي يوم/عامل" v={String(r.totalManDays)} />
        </div>

        <Card><CardHeader className="pb-2"><CardTitle className="text-base">العمالة حسب التخصص</CardTitle></CardHeader><CardContent>
          {Object.keys(r.manpower).length === 0 ? <Empty /> : (
            <Table><TableHeader><TableRow><TableHead>التخصص</TableHead><TableHead>يوم/عامل</TableHead><TableHead>متوسط يومي</TableHead></TableRow></TableHeader>
              <TableBody>{Object.entries(r.manpower).map(([k, v]) => <TableRow key={k}><TableCell>{k}</TableCell><TableCell>{v}</TableCell><TableCell>{r.daily.length ? Math.round((v / r.daily.length) * 10) / 10 : 0}</TableCell></TableRow>)}</TableBody></Table>
          )}
        </CardContent></Card>

        <Card><CardHeader className="pb-2"><CardTitle className="text-base">الأعمال المنفذة</CardTitle></CardHeader><CardContent>
          {r.daily.length === 0 ? <Empty /> : (
            <Table><TableHeader><TableRow><TableHead>التاريخ</TableHead><TableHead>الطقس</TableHead><TableHead>الأعمال</TableHead></TableRow></TableHeader>
              <TableBody>{r.daily.map((d) => <TableRow key={d.id}><TableCell className="whitespace-nowrap">{d.report_date}</TableCell><TableCell>{d.weather}</TableCell><TableCell>{d.work_done}</TableCell></TableRow>)}</TableBody></Table>
          )}
        </CardContent></Card>

        <Card><CardHeader className="pb-2"><CardTitle className="text-base">المشاكل</CardTitle></CardHeader><CardContent>
          {r.issues.length === 0 ? <Empty t="لا توجد مشاكل مسجلة" /> : <ul className="list-disc space-y-1 ps-5">{r.issues.map((i) => <li key={i.date}><b>{i.date}:</b> {i.text}</li>)}</ul>}
        </CardContent></Card>

        <Card><CardHeader className="pb-2"><CardTitle className="text-base">المستندات والأكواد</CardTitle></CardHeader><CardContent className="space-y-2">
          <div className="flex flex-wrap gap-3">{CODES.map((c) => <span key={c.v} className="flex items-center gap-1"><CodeBadge code={c.v} /> {r.codes[c.v] ?? 0}</span>)}</div>
          <SubTable rows={r.docs} lang={lang} />
        </CardContent></Card>

        <Card><CardHeader className="pb-2"><CardTitle className="text-base">طلبات الاستلام WIRs</CardTitle></CardHeader><CardContent>
          <SubTable rows={r.wirs} lang={lang} />
        </CardContent></Card>

        <Card><CardHeader className="pb-2"><CardTitle className="text-base">المستخلصات</CardTitle></CardHeader><CardContent className="space-y-2">
          <div className="flex flex-wrap gap-6"><span>مقدم في الفترة: <b>{sar(r.invoiced, lang)}</b></span><span>مصروف في الفترة (صافي): <b>{sar(r.paid, lang)}</b></span></div>
          {r.invoices.length === 0 ? <Empty /> : (
            <Table><TableHeader><TableRow><TableHead>الرقم</TableHead><TableHead>المبلغ</TableHead><TableHead>الصافي</TableHead><TableHead>الحالة</TableHead><TableHead>التقديم</TableHead><TableHead>الصرف</TableHead></TableRow></TableHeader>
              <TableBody>{r.invoices.map((i) => <TableRow key={i.id}><TableCell>#{i.invoice_no}</TableCell><TableCell>{sar(Number(i.amount), lang)}</TableCell><TableCell>{sar(Number(i.net_amount ?? 0), lang)}</TableCell><TableCell>{pick(INV_STATUSES, i.status, lang)}</TableCell><TableCell>{i.submitted_date ?? "—"}</TableCell><TableCell>{i.paid_date ?? "—"}</TableCell></TableRow>)}</TableBody></Table>
          )}
        </CardContent></Card>

        <Card><CardHeader className="pb-2"><CardTitle className="text-base">الجدول الزمني — أنشطة الفترة</CardTitle></CardHeader><CardContent>
          {r.acts.length === 0 ? <Empty /> : (
            <Table><TableHeader><TableRow><TableHead>النشاط</TableHead><TableHead>البداية</TableHead><TableHead>النهاية</TableHead><TableHead>المسؤول</TableHead><TableHead>الإنجاز</TableHead></TableRow></TableHeader>
              <TableBody>{r.acts.map((a) => <TableRow key={a.id}><TableCell>{a.name}</TableCell><TableCell>{a.start_date}</TableCell><TableCell>{a.end_date}</TableCell><TableCell>{a.owner}</TableCell><TableCell>{Number(a.progress)}%</TableCell></TableRow>)}</TableBody></Table>
          )}
        </CardContent></Card>
        <p className="text-xs text-muted-foreground">نسبة الإنجاز الفعلي هي الوضع الحالي للجدول الزمني (تراكمي)، وليست قيمة تاريخية.</p>
      </div>
    </div>
  );
}

function SubTable({ rows, lang }: { rows: ReturnType<typeof periodReport>["docs"]; lang: string }) {
  if (!rows.length) return <Empty />;
  return (
    <Table><TableHeader><TableRow><TableHead>الرقم</TableHead><TableHead>العنوان</TableHead><TableHead>التقديم</TableHead><TableHead>الرد</TableHead><TableHead>الحالة</TableHead><TableHead>الكود</TableHead></TableRow></TableHeader>
      <TableBody>{rows.map((s) => <TableRow key={s.id}><TableCell className="whitespace-nowrap">{s.ref_no}{s.revision ? ` Rev ${s.revision}` : ""}</TableCell><TableCell>{s.title}</TableCell><TableCell>{s.submitted_date ?? "—"}</TableCell><TableCell>{s.reply_date ?? "—"}</TableCell><TableCell>{pick(SUB_STATUSES, s.status, lang)}</TableCell><TableCell>{s.code ? <CodeBadge code={s.code} /> : "—"}</TableCell></TableRow>)}</TableBody></Table>
  );
}

function ReportHead({ title, projectName, sub }: { title: string; projectName: string; sub: string }) {
  return (
    <div className="flex items-end justify-between border-b border-border pb-2">
      <div><div className="text-lg font-bold">{title}</div><div className="text-muted-foreground">{projectName}</div></div>
      <div className="text-end text-muted-foreground"><div className="font-semibold text-foreground">METAL FUZE</div><div>{sub}</div></div>
    </div>
  );
}
const Sec = ({ t, children }: { t: string; children: React.ReactNode }) => <div><div className="font-semibold">{t}</div><div className="whitespace-pre-wrap">{children}</div></div>;
const Empty = ({ t = "لا يوجد في هذه الفترة" }: { t?: string }) => <p className="text-muted-foreground">{t}</p>;
