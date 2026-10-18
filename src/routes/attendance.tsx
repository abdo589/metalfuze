import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Clock, Fingerprint, UserX, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { t, useLanguage } from "@/lib/i18n";
import { useCanEdit } from "@/lib/permissions";
import { monthKey, monthLabel, usePayroll } from "@/lib/payroll";
import { LATE_AFTER, WORK_START, riyadh, summarize } from "@/lib/attendance";
import { useMonthPunches } from "@/lib/attendance-data";
import { RemoteLinks, SelfieThumb, WorkSites, useSites } from "@/components/RemoteAttendance";
import { AttendanceMap } from "@/components/AttendanceMap";
import { MonthlySheet } from "@/components/MonthlySheet";
import { useApprovedLeaves } from "@/lib/leave-data";
import { PdfButton } from "@/components/PdfButton";

export const Route = createFileRoute("/attendance")({
  head: () => ({
    meta: [
      { title: "الحضور والانصراف — Metal Fuze" },
      { name: "description", content: "حضور وانصراف موظفي Metal Fuze من جهاز البصمة ZKTeco مباشرة." },
      { property: "og:title", content: "الحضور والانصراف — Metal Fuze" },
      { property: "og:description", content: "متابعة الحضور والتأخير والغياب لحظيًا من جهاز البصمة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Attendance,
});

type Device = { serial_number: string; name: string; approved: boolean; last_seen: string | null };

function shift(key: string, d: number) {
  const [y, m] = key.split("-").map(Number);
  return monthKey(new Date(y!, m! - 1 + d, 1));
}

function Attendance() {
  useLanguage();
  const canEdit = useCanEdit();
  const employees = usePayroll();
  const [month, setMonth] = useState(monthKey());
  const punches = useMonthPunches(month);
  const [devices, setDevices] = useState<Device[]>([]);
  const [excuses, setExcuses] = useState<{ employee_id: string; excuse_date: string; reason: string }[]>([]);
  const [excuseDraft, setExcuseDraft] = useState<{ empId: string; name: string; date: string; reason: string } | null>(null);
  const { sites, reload: reloadSites } = useSites();
  const [selected, setSelected] = useState<string | null>(null);
  const today = riyadh(new Date().toISOString()).date;
  const { dates: leaveDates } = useApprovedLeaves();

  const loadDevices = async () => {
    const { data } = await supabase.from("attendance_devices").select("serial_number,name,approved,last_seen").order("created_at");
    if (data) setDevices(data);
  };
  const loadExcuses = async () => {
    const { data } = await supabase.from("late_excuses").select("employee_id,excuse_date,reason");
    if (data) setExcuses(data);
  };
  useEffect(() => { loadDevices(); loadExcuses(); }, []);

  const excuseMap = useMemo(() => new Map(excuses.map((x) => [`${x.employee_id}|${x.excuse_date}`, x.reason])), [excuses]);
  const rows = useMemo(() => {
    const byEmp = new Map<string, Set<string>>();
    for (const x of excuses) { const s = byEmp.get(x.employee_id) ?? new Set<string>(); s.add(x.excuse_date); byEmp.set(x.employee_id, s); }
    return employees.filter((e) => e.active).map((e) => ({ e, s: summarize(e, punches, month, byEmp.get(e.id), leaveDates.get(e.id)) }));
  }, [employees, punches, month, excuses, leaveDates]);
  const todayIn = rows.filter((r) => r.s.days.some((d) => d.date === today)).length;
  const lateToday = rows.filter((r) => r.s.days.some((d) => d.date === today && d.late)).length;
  const linked = rows.filter((r) => r.s.linked).length;
  const origin = typeof window === "undefined" ? "" : window.location.host;
  const sel = rows.find((r) => r.e.id === selected);

  const [newSn, setNewSn] = useState("");
  async function addDevice() {
    const sn = newSn.trim().slice(0, 64);
    if (!sn) return;
    const { error } = await supabase.from("attendance_devices").insert({ serial_number: sn, name: "ZKTeco", approved: true });
    if (error) toast.error(error.message); else { toast.success(t("تمت إضافة الجهاز")); setNewSn(""); loadDevices(); }
  }

  async function approve(sn: string, approved: boolean) {
    const { error } = await supabase.from("attendance_devices").update({ approved }).eq("serial_number", sn);
    if (error) toast.error(error.message); else { toast.success(approved ? t("تم اعتماد الجهاز") : t("تم إيقاف الجهاز")); loadDevices(); }
  }

  async function saveExcuse() {
    if (!excuseDraft) return;
    const { error } = await supabase.from("late_excuses")
      .upsert({ employee_id: excuseDraft.empId, excuse_date: excuseDraft.date, reason: excuseDraft.reason }, { onConflict: "employee_id,excuse_date" });
    if (error) toast.error(error.message); else { toast.success(t("تم حفظ العذر")); setExcuseDraft(null); loadExcuses(); }
  }

  async function removeExcuse(empId: string, date: string) {
    const { error } = await supabase.from("late_excuses").delete().eq("employee_id", empId).eq("excuse_date", date);
    if (error) toast.error(error.message); else { toast.success(t("تم حذف العذر")); setExcuseDraft(null); loadExcuses(); }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <header className="space-y-1 text-center">
        <h1 className="font-display text-2xl font-bold md:text-3xl">{t("الحضور والانصراف")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("الدوام")} {WORK_START} — {t("يُحسب تأخيرًا بعد")} {LATE_AFTER} — {t("الجمعة والسبت عطلة")}
        </p>
      </header>

      <div className="flex flex-wrap items-center justify-center gap-3 print:hidden">
        <Button variant="outline" size="icon" onClick={() => setMonth(shift(month, 1))} aria-label={t("الشهر التالي")}><ChevronRight /></Button>
        <div className="min-w-40 text-center font-display text-lg font-bold">{monthLabel(month)}</div>
        <Button variant="outline" size="icon" onClick={() => setMonth(shift(month, -1))} aria-label={t("الشهر السابق")}><ChevronLeft /></Button>
        <PdfButton />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 print:hidden">
        {[
          { label: t("حاضرون اليوم"), value: todayIn, icon: CheckCircle2 },
          { label: t("متأخرون اليوم"), value: lateToday, icon: Clock },
          { label: t("موظفون مربوطون بالبصمة"), value: `${linked} / ${rows.length}`, icon: Users },
          { label: t("البصمات هذا الشهر"), value: punches.length, icon: Fingerprint },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground"><k.icon className="size-4" /><span className="text-xs">{k.label}</span></div>
            <div className="mt-2 font-display text-xl font-bold">{k.value}</div>
          </div>
        ))}
      </div>

      <MonthlySheet rows={rows} month={month} today={today} onSelect={setSelected} excuses={excuseMap} leaves={leaveDates} />

      <div className="space-y-6 print:hidden">
      <AttendanceMap sites={sites} punches={punches} nameOf={(id) => employees.find((e) => e.id === id || e.deviceUserId === id)?.name ?? id} />

      {sel && (
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 font-display text-lg font-bold">{sel.e.name} — {monthLabel(month)}</h2>
          {(() => {
            const ids = new Set([sel.e.id, sel.e.deviceUserId].filter(Boolean));
            const list = punches.filter((p) => ids.has(p.device_user_id) && riyadh(p.punched_at).date.startsWith(month)).reverse();
            return list.length > 0 && (
              <div className="mb-4 space-y-2">
                {list.slice(0, 40).map((p) => (
                  <div key={p.punched_at + p.device_user_id} className="flex items-center gap-3 rounded-lg border border-border p-2 text-xs">
                    {p.photo_path && <SelfieThumb path={p.photo_path} />}
                    <div className="flex-1">
                      <div className="font-medium">{riyadh(p.punched_at).date} · {riyadh(p.punched_at).time}</div>
                      {p.source === "remote" && <div className="text-muted-foreground">{p.status === 1 ? t("انصراف") : t("حضور")} · {p.site_name} · {p.distance_m} {t("متر")}</div>}
                    </div>
                    <Badge variant="outline">{p.source === "remote" ? t("جوال") : t("جهاز")}</Badge>
                  </div>
                ))}
              </div>
            );
          })()}
          {sel.s.days.length === 0 ? <p className="text-sm text-muted-foreground">{t("لا توجد بصمات")}</p> : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {sel.s.days.map((d) => {
                const reason = excuseMap.get(`${sel.e.id}|${d.date}`);
                return (
                  <div key={d.date} className={`rounded-lg border p-2 text-xs ${d.excused ? "border-primary/40" : d.late ? "border-warning/40" : "border-border"}`}>
                    <div className="font-medium">{d.date}</div>
                    <div>{t("وقت الدخول")} {d.in}</div><div>{t("وقت الخروج")} {d.out ?? "—"}</div>
                    {d.late && <div className="text-warning">{t("تأخير")} {d.lateMin} {t("دقيقة")}</div>}
                    {d.excused && <div className="text-primary" title={reason}>{t("بعذر")}{reason ? `: ${reason}` : ""}</div>}
                    {canEdit && (d.late || d.excused) && (
                      <button className="mt-1 block text-[11px] text-primary underline" onClick={() => setExcuseDraft({ empId: sel.e.id, name: sel.e.name, date: d.date, reason: reason ?? "" })}>
                        {reason ? t("تعديل العذر") : t("إضافة عذر")}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      <WorkSites canEdit={canEdit} sites={sites} reload={reloadSites} />
      <RemoteLinks canEdit={canEdit} employees={employees} sites={sites} />

      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <h2 className="font-display text-lg font-bold">{t("أجهزة البصمة")}</h2>
        <div className="rounded-lg bg-muted/50 p-3 text-sm leading-7">
          <div className="font-medium">{t("إعداد جهاز ZKTeco")}:</div>
          <div>{t("القائمة ← الاتصال ← إعداد خادم السحابة (ADMS)")}</div>
          <div>{t("عنوان الخادم")}: <b dir="ltr">{origin}</b> — {t("المنفذ")}: <b>443</b> — HTTPS: {t("مفعل")}</div>
          <div>{t("أضف الرقم التسلسلي للجهاز هنا أولًا؛ الأجهزة غير المضافة تُرفض.")}</div>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <input dir="ltr" value={newSn} onChange={(e) => setNewSn(e.target.value)} placeholder={t("الرقم التسلسلي للجهاز (SN)")}
              className="h-9 min-w-56 flex-1 rounded-md border border-input bg-background px-3 text-sm" />
            <Button size="sm" onClick={addDevice} disabled={!newSn.trim()}>{t("إضافة جهاز")}</Button>
          </div>
        )}
        {devices.length === 0 ? <p className="text-sm text-muted-foreground">{t("لم يتصل أي جهاز بعد")}</p> : devices.map((d) => (
          <div key={d.serial_number} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
            <div>
              <div className="font-medium" dir="ltr">{d.name} · {d.serial_number}</div>
              <div className="text-xs text-muted-foreground">{t("آخر اتصال")}: {d.last_seen ? new Date(d.last_seen).toLocaleString() : "—"}</div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={d.approved ? "border-success/30 bg-success/15 text-success" : "border-warning/30 bg-warning/15 text-warning"}>
                {d.approved ? t("معتمد") : t("بانتظار الاعتماد")}
              </Badge>
              {canEdit && <Button size="sm" variant={d.approved ? "outline" : "default"} onClick={() => approve(d.serial_number, !d.approved)}>
                {d.approved ? <><UserX /> {t("إيقاف")}</> : t("اعتماد")}
              </Button>}
            </div>
          </div>
        ))}
      </section>
      </div>

      <Dialog open={!!excuseDraft} onOpenChange={(o) => { if (!o) setExcuseDraft(null); }}>
        <DialogContent className="print:hidden sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("عذر التأخير")} — {excuseDraft?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">{excuseDraft?.date}</div>
            <Textarea
              placeholder={t("اكتب سبب التأخير")}
              value={excuseDraft?.reason ?? ""}
              onChange={(ev) => setExcuseDraft((d) => (d ? { ...d, reason: ev.target.value } : d))}
            />
          </div>
          <DialogFooter className="gap-2">
            {excuseDraft && excuseMap.has(`${excuseDraft.empId}|${excuseDraft.date}`) && (
              <Button variant="outline" onClick={() => excuseDraft && removeExcuse(excuseDraft.empId, excuseDraft.date)}>{t("حذف العذر")}</Button>
            )}
            <Button onClick={saveExcuse}>{t("حفظ")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
