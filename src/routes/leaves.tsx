import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays, CalendarOff, CheckCircle2, ChevronLeft, ChevronRight, Clock, FileSpreadsheet,
  Link2, Paperclip, Plus, Save, Search, Settings2, Trash2, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/lib/permissions";
import { listUsers, type AppUser } from "@/lib/users.functions";
import { currentLanguage, t, useLanguage } from "@/lib/i18n";
import {
  LEAVE_STATES, countLeaveDays, eachDay, leaveError, overlaps, returnDate, stateLabel,
  type LeaveRequest, type LeaveType, type Tier,
} from "@/lib/leave-engine";

export const Route = createFileRoute("/leaves")({
  head: () => ({
    meta: [
      { title: "إدارة الإجازات — Metal Fuze" },
      { name: "description", content: "طلبات الإجازات والموافقات والأرصدة والتقويم والتقارير لموظفي Metal Fuze." },
      { property: "og:title", content: "إدارة الإجازات — Metal Fuze" },
      { property: "og:description", content: "نظام إجازات متكامل: طلبات، موافقات المدير وHR، أرصدة، تقويم وتقارير." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LeavesPage,
});

type Emp = { id: string; name: string; dept: string; role: string; joined: string | null; active: boolean; checkin_token: string | null };
type Balance = { employee_id: string; joined: string | null; entitlement: number; opening: number; adjustments: number; earned: number; used: number; booked: number; remaining: number };
type Ev = { id: string; request_id: string; action: string; from_status: string | null; to_status: string | null; note: string | null; actor_name: string; created_at: string };
type Adj = { id: string; employee_id: string; kind: string; days: number; note: string; actor_name: string; created_at: string };
type Mgr = { dept: string; user_id: string; user_name: string };
type Note = { id: string; request_id: string | null; employee_id: string | null; audience: string; dept: string | null; message: string; created_at: string };
type Settings = { tiers: Tier[]; weekend: number[]; accrual_from: string };

const TONE: Record<string, string> = {
  approved: "border-success/50 bg-success/10 text-success", rejected: "border-destructive/50 bg-destructive/10 text-destructive",
  cancelled: "border-border text-muted-foreground", pending_manager: "border-warning/50 bg-warning/10 text-warning",
  pending_hr: "border-primary/50 bg-primary/10 text-primary", draft: "border-border",
};
const fmt = (n: number) => Number(n).toLocaleString("en-US", { maximumFractionDigits: 1 });
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const select = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground";

function LeavesPage() {
  useLanguage();
  const lang = currentLanguage();
  const role = useRole();
  // Only HR (Aisha) edits leave data; HR and the CEO are the only approvers.
  const isAdmin = role === "hr";
  const isHr = role === "hr";
  const [canApprove, setCanApprove] = useState(false);
  const [me, setMe] = useState<string | null>(null);
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [reqs, setReqs] = useState<LeaveRequest[]>([]);
  const [emps, setEmps] = useState<Emp[]>([]);
  const [bal, setBal] = useState<Balance[]>([]);
  const [events, setEvents] = useState<Ev[]>([]);
  const [adjs, setAdjs] = useState<Adj[]>([]);
  const [mgrs, setMgrs] = useState<Mgr[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [settings, setSettings] = useState<Settings>({ tiers: [{ years: 0, days: 21 }, { years: 5, days: 30 }], weekend: [5, 6], accrual_from: "2026-01-01" });
  const [loaded, setLoaded] = useState(false);
  const [sel, setSel] = useState<LeaveRequest | null>(null);
  const [tab, setTab] = useState("summary");

  const load = useCallback(async () => {
    const [u, ty, rq, em, b, ev, ad, mg, nt, st] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from("leave_types").select("*").order("sort"),
      supabase.from("leave_requests").select("*").order("start_date", { ascending: false }),
      supabase.from("employees").select("id,name,dept,role,joined,active,checkin_token").order("name"),
      supabase.rpc("leave_balances"),
      supabase.from("leave_request_events").select("*").order("created_at"),
      supabase.from("leave_balance_adjustments").select("*").order("created_at", { ascending: false }),
      supabase.from("department_managers").select("*"),
      supabase.from("leave_notifications").select("*").neq("audience", "employee").order("created_at", { ascending: false }).limit(30),
      supabase.from("leave_settings").select("tiers,weekend,accrual_from").eq("id", 1).maybeSingle(),
    ]);
    if (rq.error) { toast.error(t("تعذر التحميل")); return; }
    setMe(u.data.user?.id ?? null);
    if (u.data.user) supabase.rpc("leave_can_approve", { _uid: u.data.user.id }).then(({ data }) => setCanApprove(!!data));
    setTypes((ty.data ?? []) as LeaveType[]);
    setReqs((rq.data ?? []) as unknown as LeaveRequest[]);
    setEmps((em.data ?? []) as Emp[]);
    setBal((b.data ?? []) as Balance[]);
    setEvents((ev.data ?? []) as Ev[]);
    setAdjs((ad.data ?? []) as Adj[]);
    setMgrs((mg.data ?? []) as Mgr[]);
    setNotes((nt.data ?? []) as Note[]);
    if (st.data) setSettings(st.data as unknown as Settings);
    setLoaded(true);
  }, []);
  useEffect(() => { load(); }, [load]);

  const empById = useMemo(() => new Map(emps.map((e) => [e.id, e])), [emps]);
  const typeById = useMemo(() => new Map(types.map((x) => [x.id, x])), [types]);
  const typeName = (id: string) => { const x = typeById.get(id); return x ? (lang === "en" ? x.name_en : x.name_ar) : id; };
  const myDepts = useMemo(() => new Set(mgrs.filter((m) => m.user_id === me).map((m) => m.dept)), [mgrs, me]);
  const canManagerAct = (_r: LeaveRequest) => canApprove;
  const today = todayIso();

  const pendingMgr = reqs.filter((r) => r.status === "pending_manager");
  const pendingHr = reqs.filter((r) => r.status === "pending_hr");
  const onLeave = reqs.filter((r) => r.status === "approved" && r.start_date <= today && r.end_date >= today);
  const upcoming = reqs.filter((r) => r.status === "approved" && r.start_date > today);
  const month = today.slice(0, 7);
  const monthDays = reqs.filter((r) => r.status === "approved").reduce((s, r) => s + eachDay(r.start_date, r.end_date).filter((d) => d.startsWith(month)).length, 0);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold"><CalendarOff className="size-6 text-primary" /> {t("إدارة الإجازات")}</h1>
          <p className="text-sm text-muted-foreground">{t("طلبات الإجازات والموافقات والأرصدة")}</p>
        </div>
        {isHr && <Button onClick={() => setTab("new")}><Plus /> {t("طلب إجازة جديد")}</Button>}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="summary">{t("الملخص")}</TabsTrigger>
          {isHr && <TabsTrigger value="new">{t("طلب جديد")}</TabsTrigger>}
          <TabsTrigger value="all">{t("جميع الطلبات")}</TabsTrigger>
          <TabsTrigger value="pending">{t("بانتظار الموافقة")} {pendingMgr.length + pendingHr.length > 0 && <Badge className="ms-1">{pendingMgr.length + pendingHr.length}</Badge>}</TabsTrigger>
          <TabsTrigger value="balances">{t("الأرصدة")}</TabsTrigger>
          <TabsTrigger value="history">{t("السجل السابق")}</TabsTrigger>
          <TabsTrigger value="calendar">{t("التقويم")}</TabsTrigger>
          <TabsTrigger value="reports">{t("التقارير")}</TabsTrigger>
          {isAdmin && <TabsTrigger value="settings">{t("الإعدادات")}</TabsTrigger>}
        </TabsList>

        <TabsContent value="summary" className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {[
              [t("في إجازة اليوم"), onLeave.length, CalendarOff],
              [t("بانتظار المدير"), pendingMgr.length, Clock],
              [t("بانتظار HR"), pendingHr.length, Clock],
              [t("إجازات قادمة"), upcoming.length, CalendarDays],
              [t("أيام إجازة هذا الشهر"), monthDays, CheckCircle2],
            ].map(([l, v, I]) => { const Icon = I as typeof Clock; return (
              <div key={l as string} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground">{l as string}<Icon className="size-4" /></div>
                <div className="mt-1 font-display text-2xl font-bold tabular-nums">{v as number}</div>
              </div>
            ); })}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title={t("في إجازة اليوم")}>
              {onLeave.length === 0 ? <Empty /> : onLeave.map((r) => <ReqLine key={r.id} r={r} emp={empById.get(r.employee_id)} typeName={typeName} lang={lang} onOpen={setSel} />)}
            </Panel>
            <Panel title={t("آخر الإشعارات")}>
              {notes.length === 0 ? <Empty /> : notes.filter((n) => n.audience === "hr").slice(0, 10).map((n) => {
                const [no, tn, st] = n.message.split("|");
                return <div key={n.id} className="flex justify-between gap-2 border-b border-border/50 py-1.5 text-sm last:border-0">
                  <span>{no} · {empById.get(n.employee_id ?? "")?.name} · {tn} · <b>{stateLabel(st ?? "", lang)}</b></span>
                  <span className="shrink-0 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleDateString("en-GB")}</span>
                </div>;
              })}
            </Panel>
          </div>
        </TabsContent>

        {isHr && <TabsContent value="new"><NewRequest emps={emps.filter((e) => e.active)} types={types.filter((x) => x.active)} reqs={reqs} bal={bal} settings={settings} lang={lang} onDone={() => { load(); setTab("all"); }} /></TabsContent>}

        <TabsContent value="all"><RequestsTable reqs={reqs} empById={empById} typeName={typeName} types={types} lang={lang} onOpen={setSel} /></TabsContent>

        <TabsContent value="pending" className="space-y-4">
          <Panel title={`${t("بانتظار موافقة المدير")} (${pendingMgr.length})`}>
            {pendingMgr.length === 0 ? <Empty /> : pendingMgr.map((r) => <ReqLine key={r.id} r={r} emp={empById.get(r.employee_id)} typeName={typeName} lang={lang} onOpen={setSel} hint={canManagerAct(r) ? t("يمكنك المراجعة") : `${t("المدير")}: ${mgrs.find((m) => m.dept === empById.get(r.employee_id)?.dept)?.user_name ?? t("غير محدد")}`} />)}
          </Panel>
          <Panel title={`${t("بانتظار مراجعة HR")} (${pendingHr.length})`}>
            {pendingHr.length === 0 ? <Empty /> : pendingHr.map((r) => <ReqLine key={r.id} r={r} emp={empById.get(r.employee_id)} typeName={typeName} lang={lang} onOpen={setSel} />)}
          </Panel>
        </TabsContent>

        <TabsContent value="balances"><Balances emps={emps} bal={bal} adjs={adjs} isHr={isHr} onDone={load} /></TabsContent>

        <TabsContent value="history">
          <RequestsTable reqs={reqs.filter((r) => r.end_date < today || r.status === "rejected" || r.status === "cancelled")} empById={empById} typeName={typeName} types={types} lang={lang} onOpen={setSel} />
        </TabsContent>

        <TabsContent value="calendar"><LeaveCalendar reqs={reqs} empById={empById} typeName={typeName} onOpen={setSel} weekend={settings.weekend} /></TabsContent>

        <TabsContent value="reports"><Reports reqs={reqs} emps={emps} types={types} typeName={typeName} lang={lang} /></TabsContent>

        {isAdmin && <TabsContent value="settings"><SettingsTab types={types} settings={settings} mgrs={mgrs} emps={emps} onDone={load} /></TabsContent>}
      </Tabs>

      {!loaded && <p className="text-center text-sm text-muted-foreground">{t("جارٍ التحميل…")}</p>}

      <RequestDialog r={sel} onClose={() => setSel(null)} emp={sel ? empById.get(sel.employee_id) : undefined} typeName={typeName} lang={lang}
        events={events.filter((e) => e.request_id === sel?.id)} balance={bal.find((b) => b.employee_id === sel?.employee_id)}
        canManager={canApprove} canHr={isHr} canApprove={canApprove} usesBalance={!!sel && !!typeById.get(sel.type_id)?.uses_balance}
        onDone={() => { setSel(null); load(); }} />
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-xl border border-border bg-card p-4"><h2 className="mb-2 font-bold">{title}</h2>{children}</section>;
}
const Empty = () => <p className="py-4 text-center text-sm text-muted-foreground">{t("لا توجد بيانات")}</p>;

function ReqLine({ r, emp, typeName, lang, onOpen, hint }: { r: LeaveRequest; emp?: Emp | undefined; typeName: (id: string) => string; lang: "ar" | "en"; onOpen: (r: LeaveRequest) => void; hint?: string | undefined }) {
  return (
    <button onClick={() => onOpen(r)} className="flex w-full flex-wrap items-center justify-between gap-2 border-b border-border/50 py-2 text-start text-sm last:border-0 hover:bg-muted/40">
      <span><b>#{r.request_no}</b> · {emp?.name ?? r.employee_id} · {typeName(r.type_id)} · {r.start_date} → {r.end_date} ({r.working_days} {t("يوم")}){hint && <span className="ms-2 text-xs text-muted-foreground">{hint}</span>}</span>
      <Badge variant="outline" className={TONE[r.status]}>{stateLabel(r.status, lang)}</Badge>
    </button>
  );
}

function RequestsTable({ reqs, empById, typeName, types, lang, onOpen }: { reqs: LeaveRequest[]; empById: Map<string, Emp>; typeName: (id: string) => string; types: LeaveType[]; lang: "ar" | "en"; onOpen: (r: LeaveRequest) => void }) {
  const [q, setQ] = useState("");
  const [st, setSt] = useState("all");
  const [ty, setTy] = useState("all");
  const rows = reqs.filter((r) => (st === "all" || r.status === st) && (ty === "all" || r.type_id === ty)
    && (!q || `${r.request_no} ${empById.get(r.employee_id)?.name ?? ""} ${empById.get(r.employee_id)?.dept ?? ""} ${r.reason}`.includes(q)));
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="relative"><Search className="absolute start-2 top-2.5 size-4 text-muted-foreground" /><Input className="ps-8" placeholder={t("بحث")} value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className={select} value={st} onChange={(e) => setSt(e.target.value)}><option value="all">{t("كل الحالات")}</option>{LEAVE_STATES.map((s) => <option key={s.key} value={s.key}>{lang === "en" ? s.en : s.ar}</option>)}</select>
        <select className={select} value={ty} onChange={(e) => setTy(e.target.value)}><option value="all">{t("كل الأنواع")}</option>{types.map((x) => <option key={x.id} value={x.id}>{lang === "en" ? x.name_en : x.name_ar}</option>)}</select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead><tr className="border-b border-border text-start text-xs text-muted-foreground">
            {["رقم الطلب", "الموظف", "الإدارة", "نوع الإجازة", "من", "إلى", "الأيام", "العودة", "الحالة"].map((h) => <th key={h} className="p-2 text-start">{t(h)}</th>)}
          </tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={9}><Empty /></td></tr>}
            {rows.map((r) => (
              <tr key={r.id} onClick={() => onOpen(r)} className="cursor-pointer border-b border-border/50 hover:bg-muted/40">
                <td className="p-2 font-medium">#{r.request_no}</td>
                <td className="p-2">{empById.get(r.employee_id)?.name ?? r.employee_id}</td>
                <td className="p-2">{empById.get(r.employee_id)?.dept}</td>
                <td className="p-2">{typeName(r.type_id)}</td>
                <td className="p-2 tabular-nums">{r.start_date}</td>
                <td className="p-2 tabular-nums">{r.end_date}</td>
                <td className="p-2 tabular-nums">{r.working_days}</td>
                <td className="p-2 tabular-nums">{r.return_date}</td>
                <td className="p-2"><Badge variant="outline" className={TONE[r.status]}>{stateLabel(r.status, lang)}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function NewRequest({ emps, types, reqs, bal, settings, lang, onDone }: { emps: Emp[]; types: LeaveType[]; reqs: LeaveRequest[]; bal: Balance[]; settings: Settings; lang: "ar" | "en"; onDone: () => void }) {
  const [f, setF] = useState({ emp: "", type: "annual", start: "", end: "", reason: "", ret: "" });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const emp = emps.find((e) => e.id === f.emp);
  const type = types.find((x) => x.id === f.type);
  const days = f.start && f.end && f.end >= f.start ? countLeaveDays(f.start, f.end, settings.weekend, type?.calendar_days) : 0;
  const b = bal.find((x) => x.employee_id === f.emp);
  const clash = f.emp && f.start && f.end ? overlaps(reqs, f.emp, f.start, f.end) : [];

  async function save(submit: boolean) {
    if (!emp || !type) { toast.error(t("اختر الموظف ونوع الإجازة")); return; }
    if (!f.start || !f.end) { toast.error(t("اختر تاريخ البداية والنهاية")); return; }
    if (f.end < f.start) { toast.error(t("تاريخ النهاية قبل تاريخ البداية")); return; }
    if (clash.length) { toast.error(t("يوجد طلب إجازة آخر في نفس الفترة")); return; }
    if (submit && type.requires_attachment && !file) { toast.error(t("هذا النوع يحتاج مرفقًا (مثل التقرير الطبي)")); return; }
    setBusy(true);
    try {
      let path: string | undefined;
      if (file) {
        path = `leave/${emp.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
        const up = await supabase.storage.from("employee-files").upload(path, file);
        if (up.error) { toast.error(t("تعذر رفع الملف")); return; }
      }
      const { error } = await supabase.rpc("leave_create", {
        p_emp: emp.id, p_type: type.id, p_start: f.start, p_end: f.end, p_reason: f.reason,
        p_submit: submit, ...(path ? { p_attach_path: path } : {}), ...(file ? { p_attach_name: file.name } : {}), ...(f.ret ? { p_return: f.ret } : {}),
      });
      if (error) { if (path) await supabase.storage.from("employee-files").remove([path]); toast.error(t(leaveError(error.message))); return; }
      toast.success(t(submit ? "تم إرسال الطلب إلى المدير" : "تم حفظ المسودة"));
      setF({ emp: "", type: "annual", start: "", end: "", reason: "", ret: "" }); setFile(null); onDone();
    } finally { setBusy(false); }
  }

  return (
    <section className="grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-2">
      <label className="text-sm">{t("الموظف")}<select className={`${select} mt-1`} value={f.emp} onChange={(e) => setF({ ...f, emp: e.target.value })}>
        <option value="">—</option>{emps.map((e) => <option key={e.id} value={e.id}>{e.id} · {e.name}</option>)}</select></label>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div><div className="text-xs text-muted-foreground">{t("الإدارة")}</div><div className="mt-2 font-medium">{emp?.dept || "—"}</div></div>
        <div><div className="text-xs text-muted-foreground">{t("المسمى الوظيفي")}</div><div className="mt-2 font-medium">{emp?.role || "—"}</div></div>
      </div>
      <label className="text-sm">{t("نوع الإجازة")}<select className={`${select} mt-1`} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
        {types.map((x) => <option key={x.id} value={x.id}>{lang === "en" ? x.name_en : x.name_ar}{x.max_days ? ` (${x.max_days})` : ""}</option>)}</select></label>
      <div className="text-sm">
        <div className="text-xs text-muted-foreground">{t("الرصيد المتبقي")}</div>
        <div className="mt-2 font-medium">{b ? fmt(b.remaining) : "—"} {type?.uses_balance ? "" : <span className="text-xs text-muted-foreground">({t("هذا النوع لا يخصم من الرصيد")})</span>}</div>
      </div>
      <label className="text-sm">{t("تاريخ البداية")}<Input type="date" className="mt-1" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></label>
      <label className="text-sm">{t("تاريخ النهاية")}<Input type="date" className="mt-1" min={f.start} value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></label>
      <div className="text-sm"><div className="text-xs text-muted-foreground">{t("عدد الأيام")}</div><div className="mt-2 font-display text-xl font-bold">{days}</div>
        {type?.uses_balance && b && days > b.remaining && <div className="text-xs text-destructive">{t("الرصيد المتبقي لا يكفي لهذا الطلب")}</div>}
        {clash.length > 0 && <div className="text-xs text-destructive">{t("يوجد طلب إجازة آخر في نفس الفترة")}</div>}
      </div>
      <label className="text-sm">{t("تاريخ العودة إلى العمل")}<Input type="date" className="mt-1" value={f.ret || (f.end ? returnDate(f.end, settings.weekend) : "")} onChange={(e) => setF({ ...f, ret: e.target.value })} /></label>
      <label className="text-sm md:col-span-2">{t("سبب الإجازة")}<Textarea className="mt-1" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></label>
      <label className="flex cursor-pointer items-center gap-2 text-sm md:col-span-2"><Paperclip className="size-4" />
        {file ? file.name : t(type?.requires_attachment ? "إرفاق مستند (مطلوب)" : "إرفاق مستند (اختياري)")}
        <input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
      <div className="flex gap-2 md:col-span-2">
        <Button disabled={busy} onClick={() => save(true)}>{t("إرسال للموافقة")}</Button>
        <Button disabled={busy} variant="outline" onClick={() => save(false)}><Save /> {t("حفظ كمسودة")}</Button>
      </div>
    </section>
  );
}

function RequestDialog({ r, onClose, emp, typeName, lang, events, balance, canManager, canHr, canApprove, usesBalance, onDone }: {
  r: LeaveRequest | null; onClose: () => void; emp?: Emp | undefined; typeName: (id: string) => string; lang: "ar" | "en"; events: Ev[];
  balance?: Balance | undefined; canManager: boolean; canHr: boolean; canApprove: boolean; usesBalance: boolean; onDone: () => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => setNote(""), [r?.id]);
  if (!r) return null;

  async function act(action: string) {
    if (!r) return;
    if (action.endsWith("reject") && !note.trim()) { toast.error(t("اكتب سبب الرفض")); return; }
    setBusy(true);
    const { error } = await supabase.rpc("leave_transition", { p_id: r.id, p_action: action, ...(note ? { p_note: note } : {}) });
    setBusy(false);
    if (error) { toast.error(t(leaveError(error.message))); return; }
    toast.success(t("تم التحديث")); onDone();
  }
  async function openFile() {
    if (!r?.attachment_path) return;
    const { data, error } = await supabase.storage.from("employee-files").createSignedUrl(r.attachment_path, 30);
    if (error || !data) { toast.error(t("تعذر فتح الملف")); return; }
    window.open(data.signedUrl, "_blank");
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>#{r.request_no} · {emp?.name} · {typeName(r.type_id)}</DialogTitle></DialogHeader>
        <Badge variant="outline" className={`w-fit ${TONE[r.status]}`}>{stateLabel(r.status, lang)}</Badge>
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          {[["رقم الموظف", r.employee_id], ["الإدارة", emp?.dept], ["المسمى الوظيفي", emp?.role], ["عدد الأيام", r.working_days],
            ["من", r.start_date], ["إلى", r.end_date], ["تاريخ العودة", r.return_date], ["الرصيد المتبقي", balance ? fmt(balance.remaining) : "—"],
            ["سبب الإجازة", r.reason || "—"], ["ملاحظة المدير", r.manager_note || "—"], ["ملاحظة HR", r.hr_note || "—"]].map(([k, v]) => (
            <div key={k as string} className="rounded-lg border border-border p-2"><div className="text-xs text-muted-foreground">{t(k as string)}</div><div className="font-medium">{String(v ?? "—")}</div></div>
          ))}
        </div>
        {r.attachment_path && <Button variant="outline" size="sm" className="w-fit" onClick={openFile}><Paperclip /> {r.attachment_name ?? t("المرفق")}</Button>}
        {usesBalance && r.status === "pending_hr" && balance && r.working_days > balance.remaining && <p className="text-sm text-destructive">{t("الرصيد المتبقي لا يكفي لهذا الطلب")}</p>}

        {((r.status === "pending_manager" && canManager) || (r.status === "pending_hr" && canApprove) || (canHr && !["rejected", "cancelled"].includes(r.status))) && (
          <div className="space-y-2 rounded-lg border border-border p-3">
            <Textarea placeholder={t("ملاحظة / سبب الرفض")} value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              {r.status === "draft" && canHr && <Button disabled={busy} onClick={() => act("submit")}>{t("إرسال للموافقة")}</Button>}
              {r.status === "pending_manager" && canManager && <>
                <Button disabled={busy} onClick={() => act("manager_approve")}><CheckCircle2 /> {t("موافقة المدير")}</Button>
                <Button disabled={busy} variant="outline" className="text-destructive" onClick={() => act("manager_reject")}><XCircle /> {t("رفض")}</Button></>}
              {r.status === "pending_hr" && canApprove && <>
                <Button disabled={busy} onClick={() => act("hr_approve")}><CheckCircle2 /> {t("اعتماد نهائي")}</Button>
                <Button disabled={busy} variant="outline" className="text-destructive" onClick={() => act("hr_reject")}><XCircle /> {t("رفض")}</Button></>}
              {canHr && !["rejected", "cancelled"].includes(r.status) && <Button disabled={busy} variant="ghost" onClick={() => act("cancel")}>{t("إلغاء الطلب")}</Button>}
            </div>
          </div>
        )}

        <div>
          <h3 className="mb-1 font-bold">{t("سجل الطلب")}</h3>
          {events.map((e) => (
            <div key={e.id} className="border-s-2 border-primary/40 ps-3 pb-2 text-sm">
              <div><b>{stateLabel(e.to_status ?? "", lang)}</b> · {e.actor_name || "—"}</div>
              {e.note && <div className="text-muted-foreground">{e.note}</div>}
              <div className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString("en-GB")}</div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Balances({ emps, bal, adjs, isHr, onDone }: { emps: Emp[]; bal: Balance[]; adjs: Adj[]; isHr: boolean; onDone: () => void }) {
  const [q, setQ] = useState("");
  const [adj, setAdj] = useState<{ emp: Emp; kind: "opening" | "adjust"; days: string; note: string } | null>(null);
  const [log, setLog] = useState<Emp | null>(null);
  const byId = new Map(bal.map((b) => [b.employee_id, b]));
  const rows = emps.filter((e) => e.active && (!q || `${e.id} ${e.name} ${e.dept}`.includes(q)));

  async function save() {
    if (!adj) return;
    const n = Number(adj.days);
    if (!adj.days || isNaN(n)) { toast.error(t("اكتب عدد الأيام")); return; }
    const { error } = await supabase.rpc("leave_adjust", { p_emp: adj.emp.id, p_days: n, p_kind: adj.kind, p_note: adj.note });
    if (error) { toast.error(t(leaveError(error.message))); return; }
    toast.success(t("تم التحديث")); setAdj(null); onDone();
  }
  function copyLink(e: Emp) {
    if (!e.checkin_token) { toast.error(t("لا يوجد رابط لهذا الموظف")); return; }
    navigator.clipboard.writeText(`${window.location.origin}/leave/${e.checkin_token}`);
    toast.success(t("تم نسخ رابط الإجازات"));
  }

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="relative max-w-sm"><Search className="absolute start-2 top-2.5 size-4 text-muted-foreground" /><Input className="ps-8" placeholder={t("بحث")} value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead><tr className="border-b border-border text-xs text-muted-foreground">
            {["الموظف", "تاريخ بداية الخدمة", "الاستحقاق السنوي", "رصيد بداية الفترة", "تعديلات", "المكتسب", "المستخدم", "المحجوز", "المتبقي", ""].map((h) => <th key={h} className="p-2 text-start">{h && t(h)}</th>)}
          </tr></thead>
          <tbody>
            {rows.map((e) => { const b = byId.get(e.id); return (
              <tr key={e.id} className="border-b border-border/50">
                <td className="p-2"><div className="font-medium">{e.name}</div><div className="text-xs text-muted-foreground">{e.id} · {e.dept}</div></td>
                <td className="p-2 tabular-nums">{e.joined ?? "—"}</td>
                <td className="p-2 tabular-nums">{b ? fmt(b.entitlement) : "—"}</td>
                <td className="p-2 tabular-nums">{b ? fmt(b.opening) : "—"}</td>
                <td className="p-2 tabular-nums">{b ? fmt(b.adjustments) : "—"}</td>
                <td className="p-2 tabular-nums">{b ? fmt(b.earned) : "—"}</td>
                <td className="p-2 tabular-nums">{b ? fmt(b.used) : "—"}</td>
                <td className="p-2 tabular-nums">{b ? fmt(b.booked) : "—"}</td>
                <td className="p-2 font-bold tabular-nums">{b ? fmt(b.remaining) : "—"}</td>
                <td className="p-2"><div className="flex gap-1">
                  {isHr && <Button size="sm" variant="outline" onClick={() => setAdj({ emp: e, kind: "adjust", days: "", note: "" })}>{t("تعديل الرصيد")}</Button>}
                  <Button size="sm" variant="ghost" onClick={() => setLog(e)}>{t("الحركات")}</Button>
                  {isHr && <Button size="icon" variant="ghost" title={t("نسخ رابط الإجازات")} onClick={() => copyLink(e)}><Link2 /></Button>}
                </div></td>
              </tr>
            ); })}
          </tbody>
        </table>
      </div>

      <Dialog open={!!adj} onOpenChange={(o) => !o && setAdj(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("تعديل الرصيد")} — {adj?.emp.name}</DialogTitle></DialogHeader>
          {adj && <div className="space-y-2">
            <select className={select} value={adj.kind} onChange={(e) => setAdj({ ...adj, kind: e.target.value as "opening" | "adjust" })}>
              <option value="opening">{t("رصيد بداية الفترة")}</option><option value="adjust">{t("تعديل (+/-)")}</option></select>
            <Input type="number" step="0.5" placeholder={t("عدد الأيام (سالب للخصم)")} value={adj.days} onChange={(e) => setAdj({ ...adj, days: e.target.value })} />
            <Textarea placeholder={t("سبب التعديل (مطلوب)")} value={adj.note} onChange={(e) => setAdj({ ...adj, note: e.target.value })} />
            <Button onClick={save}><Save /> {t("حفظ")}</Button>
          </div>}
        </DialogContent>
      </Dialog>

      <Dialog open={!!log} onOpenChange={(o) => !o && setLog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("حركات الرصيد")} — {log?.name}</DialogTitle></DialogHeader>
          {adjs.filter((a) => a.employee_id === log?.id).length === 0 ? <Empty /> : adjs.filter((a) => a.employee_id === log?.id).map((a) => (
            <div key={a.id} className="border-b border-border/50 py-2 text-sm">
              <b className="tabular-nums">{a.days > 0 ? "+" : ""}{a.days}</b> · {t(a.kind === "opening" ? "رصيد بداية الفترة" : "تعديل (+/-)")} · {a.note}
              <div className="text-xs text-muted-foreground">{a.actor_name} · {new Date(a.created_at).toLocaleString("en-GB")}</div>
            </div>
          ))}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function LeaveCalendar({ reqs, empById, typeName, onOpen, weekend }: { reqs: LeaveRequest[]; empById: Map<string, Emp>; typeName: (id: string) => string; onOpen: (r: LeaveRequest) => void; weekend: number[] }) {
  const [ym, setYm] = useState(() => todayIso().slice(0, 7));
  const [y, m] = ym.split("-").map(Number);
  const first = new Date(Date.UTC(y!, m! - 1, 1));
  const count = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  const lead = first.getUTCDay();
  const active = reqs.filter((r) => !["rejected", "cancelled", "draft"].includes(r.status));
  const shift = (n: number) => { const d = new Date(Date.UTC(y!, m! - 1 + n, 1)); setYm(d.toISOString().slice(0, 7)); };
  const label = first.toLocaleDateString(currentLanguage() === "en" ? "en-GB" : "ar-SA-u-ca-gregory", { month: "long", year: "numeric", timeZone: "UTC" });
  const wd = Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(2026, 9, 18 + i)).toLocaleDateString(currentLanguage() === "en" ? "en-GB" : "ar-SA", { weekday: "short", timeZone: "UTC" }));
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <Button size="icon" variant="outline" onClick={() => shift(-1)}><ChevronRight className="rtl:rotate-0 ltr:rotate-180" /></Button>
        <h2 className="font-bold">{label}</h2>
        <Button size="icon" variant="outline" onClick={() => shift(1)}><ChevronLeft className="rtl:rotate-0 ltr:rotate-180" /></Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-xs">
        {wd.map((w) => <div key={w} className="p-1 text-center font-medium text-muted-foreground">{w}</div>)}
        {Array.from({ length: lead }).map((_, i) => <div key={`l${i}`} />)}
        {Array.from({ length: count }, (_, i) => {
          const d = `${ym}-${String(i + 1).padStart(2, "0")}`;
          const off = weekend.includes(new Date(`${d}T00:00:00Z`).getUTCDay());
          const on = active.filter((r) => r.start_date <= d && r.end_date >= d);
          return (
            <div key={d} className={`min-h-20 rounded-md border border-border p-1 ${off ? "bg-muted/60" : ""}`}>
              <div className="text-muted-foreground">{i + 1}</div>
              {on.slice(0, 3).map((r) => (
                <button key={r.id} onClick={() => onOpen(r)} title={typeName(r.type_id)}
                  className={`mt-0.5 block w-full truncate rounded px-1 text-start ${r.status === "approved" ? "bg-primary/20 text-foreground" : "border border-dashed border-warning/60 text-muted-foreground"}`}>
                  {empById.get(r.employee_id)?.name.split(" ")[0]}
                </button>
              ))}
              {on.length > 3 && <div className="text-muted-foreground">+{on.length - 3}</div>}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">{t("الملوّن: معتمد · المنقّط: بانتظار الموافقة")}</p>
    </section>
  );
}

function Reports({ reqs, emps, types, typeName, lang }: { reqs: LeaveRequest[]; emps: Emp[]; types: LeaveType[]; typeName: (id: string) => string; lang: "ar" | "en" }) {
  const [f, setF] = useState({ emp: "all", type: "all", dept: "all", status: "all", from: "", to: "" });
  const empById = new Map(emps.map((e) => [e.id, e]));
  const depts = [...new Set(emps.map((e) => e.dept).filter(Boolean))].sort();
  const rows = reqs.filter((r) => (f.emp === "all" || r.employee_id === f.emp) && (f.type === "all" || r.type_id === f.type)
    && (f.dept === "all" || empById.get(r.employee_id)?.dept === f.dept) && (f.status === "all" || r.status === f.status)
    && (!f.from || r.end_date >= f.from) && (!f.to || r.start_date <= f.to));
  const total = rows.reduce((s, r) => s + Number(r.working_days), 0);
  const byType = types.map((x) => ({ x, n: rows.filter((r) => r.type_id === x.id).reduce((s, r) => s + Number(r.working_days), 0) })).filter((g) => g.n > 0);
  const max = Math.max(1, ...byType.map((g) => g.n));

  async function exportXlsx() {
    try {
      const { exportBrandedExcel } = await import("@/lib/branded-excel");
      const d = todayIso();
      await exportBrandedExcel({
        filename: `${lang === "en" ? "Leave-report" : "تقرير-الإجازات"}-${d}.xlsx`,
        reportTitle: `${t("تقرير الإجازات")} — ${d}`,
        summary: [[t("عدد الطلبات"), rows.length, "int"], [t("إجمالي الأيام"), total, "int"]],
        sheets: [{
          name: t("الإجازات"), title: `${t("تقرير الإجازات")} — Metal Fuze`,
          columns: ["رقم الطلب", "رقم الموظف", "الموظف", "الإدارة", "المسمى الوظيفي", "نوع الإجازة", "من", "إلى", "الأيام", "العودة", "الحالة", "سبب الإجازة", "ملاحظة المدير", "ملاحظة HR"].map((h) => ({ header: t(h), width: 18 })),
          rows: rows.map((r) => { const e = empById.get(r.employee_id); return [r.request_no, r.employee_id, e?.name, e?.dept, e?.role, typeName(r.type_id), r.start_date, r.end_date, Number(r.working_days), r.return_date, stateLabel(r.status, lang), r.reason, r.manager_note, r.hr_note]; }),
          totals: [8],
        }],
      });
      toast.success(t("تم تصدير تقرير Excel"));
    } catch { toast.error(t("تعذر التصدير")); }
  }

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <select className={select} value={f.emp} onChange={(e) => setF({ ...f, emp: e.target.value })}><option value="all">{t("كل الموظفين")}</option>{emps.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
        <select className={select} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}><option value="all">{t("كل الأنواع")}</option>{types.map((x) => <option key={x.id} value={x.id}>{lang === "en" ? x.name_en : x.name_ar}</option>)}</select>
        <select className={select} value={f.dept} onChange={(e) => setF({ ...f, dept: e.target.value })}><option value="all">{t("كل الإدارات")}</option>{depts.map((d) => <option key={d} value={d}>{d}</option>)}</select>
        <select className={select} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="all">{t("كل الحالات")}</option>{LEAVE_STATES.map((s) => <option key={s.key} value={s.key}>{lang === "en" ? s.en : s.ar}</option>)}</select>
        <Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} title={t("من")} />
        <Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} title={t("إلى")} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm">{t("عدد الطلبات")}: <b>{rows.length}</b> · {t("إجمالي الأيام")}: <b>{total}</b></p>
        <Button variant="outline" onClick={exportXlsx}><FileSpreadsheet /> {t("تصدير Excel")}</Button>
      </div>
      <div className="space-y-1">
        {byType.map((g) => (
          <div key={g.x.id} className="flex items-center gap-2 text-sm">
            <span className="w-40 shrink-0 truncate">{lang === "en" ? g.x.name_en : g.x.name_ar}</span>
            <div className="h-3 flex-1 rounded bg-muted"><div className="h-3 rounded bg-primary" style={{ width: `${(g.n / max) * 100}%` }} /></div>
            <span className="w-10 text-end tabular-nums">{g.n}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function SettingsTab({ types, settings, mgrs, emps, onDone }: { types: LeaveType[]; settings: Settings; mgrs: Mgr[]; emps: Emp[]; onDone: () => void }) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [tiers, setTiers] = useState<Tier[]>(settings.tiers);
  const [accrual, setAccrual] = useState(settings.accrual_from);
  const [list, setList] = useState<LeaveType[]>(types);
  useEffect(() => { listUsers().then(setUsers).catch(() => {}); }, []);
  useEffect(() => setList(types), [types]);
  useEffect(() => { setTiers(settings.tiers); setAccrual(settings.accrual_from); }, [settings]);
  const depts = [...new Set(emps.map((e) => e.dept).filter(Boolean))].sort();

  async function savePolicy() {
    const { error } = await supabase.from("leave_settings").update({ tiers, accrual_from: accrual }).eq("id", 1);
    if (error) { toast.error(t("تعذر الحفظ")); return; } toast.success(t("تم الحفظ")); onDone();
  }
  async function saveType(x: LeaveType) {
    const { error } = await supabase.from("leave_types").update({ name_ar: x.name_ar, name_en: x.name_en, paid: x.paid, uses_balance: x.uses_balance, max_days: x.max_days, requires_attachment: x.requires_attachment, calendar_days: x.calendar_days, active: x.active }).eq("id", x.id);
    if (error) { toast.error(t("تعذر الحفظ")); return; } toast.success(t("تم الحفظ")); onDone();
  }
  async function setMgr(dept: string, uid: string) {
    const res = uid
      ? await supabase.from("department_managers").upsert({ dept, user_id: uid, user_name: users.find((u) => u.id === uid)?.name ?? "" })
      : await supabase.from("department_managers").delete().eq("dept", dept);
    if (res.error) { toast.error(t("تعذر الحفظ")); return; } toast.success(t("تم الحفظ")); onDone();
  }
  const upd = (id: string, p: Partial<LeaveType>) => setList(list.map((x) => (x.id === id ? { ...x, ...p } : x)));

  return (
    <div className="space-y-4">
      <Panel title={t("مدير كل إدارة")}>
        <div className="grid gap-2 sm:grid-cols-2">
          {depts.map((d) => (
            <label key={d} className="text-sm">{d}
              <select className={`${select} mt-1`} value={mgrs.find((m) => m.dept === d)?.user_id ?? ""} onChange={(e) => setMgr(d, e.target.value)}>
                <option value="">{t("غير محدد")}</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{t("المدير لازم يكون عنده حساب دخول. مدير النظام يقدر يوافق بدل أي مدير.")}</p>
      </Panel>

      <Panel title={t("قواعد الاستحقاق السنوي")}>
        <div className="space-y-2">
          {tiers.map((x, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
              {t("من")} <Input type="number" className="w-20" value={x.years} onChange={(e) => setTiers(tiers.map((y, j) => (j === i ? { ...y, years: Number(e.target.value) } : y)))} /> {t("سنوات خدمة")}
              → <Input type="number" className="w-20" value={x.days} onChange={(e) => setTiers(tiers.map((y, j) => (j === i ? { ...y, days: Number(e.target.value) } : y)))} /> {t("يوم سنويًا")}
              <Button size="icon" variant="ghost" onClick={() => setTiers(tiers.filter((_, j) => j !== i))}><Trash2 /></Button>
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={() => setTiers([...tiers, { years: 10, days: 30 }])}><Plus /> {t("إضافة شريحة")}</Button>
          <label className="block text-sm">{t("بداية احتساب الاستحقاق في النظام")}<Input type="date" className="mt-1 w-48" value={accrual} onChange={(e) => setAccrual(e.target.value)} /></label>
          <Button onClick={savePolicy}><Settings2 /> {t("حفظ القواعد")}</Button>
        </div>
      </Panel>

      <Panel title={t("أنواع الإجازات")}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead><tr className="border-b border-border text-xs text-muted-foreground">
              {["الاسم بالعربي", "الاسم بالإنجليزي", "مدفوعة", "تخصم من الرصيد", "الحد الأقصى", "مرفق مطلوب", "أيام تقويمية", "مفعلة", ""].map((h) => <th key={h} className="p-2 text-start">{h && t(h)}</th>)}
            </tr></thead>
            <tbody>
              {list.map((x) => (
                <tr key={x.id} className="border-b border-border/50">
                  <td className="p-1"><Input value={x.name_ar} onChange={(e) => upd(x.id, { name_ar: e.target.value })} /></td>
                  <td className="p-1"><Input value={x.name_en} onChange={(e) => upd(x.id, { name_en: e.target.value })} /></td>
                  {(["paid", "uses_balance"] as const).map((k) => <td key={k} className="p-1 text-center"><input type="checkbox" checked={x[k]} onChange={(e) => upd(x.id, { [k]: e.target.checked })} /></td>)}
                  <td className="p-1"><Input type="number" className="w-20" value={x.max_days ?? ""} onChange={(e) => upd(x.id, { max_days: e.target.value ? Number(e.target.value) : null })} /></td>
                  {(["requires_attachment", "calendar_days", "active"] as const).map((k) => <td key={k} className="p-1 text-center"><input type="checkbox" checked={x[k]} onChange={(e) => upd(x.id, { [k]: e.target.checked })} /></td>)}
                  <td className="p-1"><Button size="sm" variant="outline" onClick={() => saveType(x)}><Save /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

