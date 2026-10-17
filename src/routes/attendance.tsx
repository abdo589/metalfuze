import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Clock, Fingerprint, UserX, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { t, useLanguage } from "@/lib/i18n";
import { useCanEdit } from "@/lib/permissions";
import { monthKey, monthLabel, usePayroll } from "@/lib/payroll";
import { LATE_AFTER, WORK_START, riyadh, summarize } from "@/lib/attendance";
import { useMonthPunches } from "@/lib/attendance-data";

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
  const [selected, setSelected] = useState<string | null>(null);
  const today = riyadh(new Date().toISOString()).date;

  const loadDevices = async () => {
    const { data } = await supabase.from("attendance_devices").select("serial_number,name,approved,last_seen").order("created_at");
    if (data) setDevices(data);
  };
  useEffect(() => { loadDevices(); }, []);

  const rows = useMemo(() => employees.filter((e) => e.active).map((e) => ({ e, s: summarize(e, punches, month) })), [employees, punches, month]);
  const todayIn = rows.filter((r) => r.s.days.some((d) => d.date === today)).length;
  const lateToday = rows.filter((r) => r.s.days.some((d) => d.date === today && d.late)).length;
  const linked = rows.filter((r) => r.s.linked).length;
  const origin = typeof window === "undefined" ? "" : window.location.host;
  const sel = rows.find((r) => r.e.id === selected);

  async function approve(sn: string, approved: boolean) {
    const { error } = await supabase.from("attendance_devices").update({ approved }).eq("serial_number", sn);
    if (error) toast.error(error.message); else { toast.success(approved ? t("تم اعتماد الجهاز") : t("تم إيقاف الجهاز")); loadDevices(); }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <header className="space-y-1 text-center">
        <h1 className="font-display text-2xl font-bold md:text-3xl">{t("الحضور والانصراف")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("الدوام")} {WORK_START} — {t("يُحسب تأخيرًا بعد")} {LATE_AFTER} — {t("الجمعة والسبت عطلة")}
        </p>
      </header>

      <div className="flex items-center justify-center gap-3">
        <Button variant="outline" size="icon" onClick={() => setMonth(shift(month, 1))} aria-label={t("الشهر التالي")}><ChevronRight /></Button>
        <div className="min-w-40 text-center font-display text-lg font-bold">{monthLabel(month)}</div>
        <Button variant="outline" size="icon" onClick={() => setMonth(shift(month, -1))} aria-label={t("الشهر السابق")}><ChevronLeft /></Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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

      <section className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[700px] text-sm">
          <thead>
            <tr className="border-b border-border text-right text-xs text-muted-foreground">
              <th className="p-3 font-medium">{t("الموظف")}</th>
              <th className="p-3 font-medium">{t("رقم البصمة")}</th>
              <th className="p-3 font-medium">{t("اليوم")}</th>
              <th className="p-3 font-medium">{t("حضور")}</th>
              <th className="p-3 font-medium">{t("تأخير")}</th>
              <th className="p-3 font-medium">{t("غياب")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">{t("أضف الموظفين من صفحة الرواتب أولًا")}</td></tr>}
            {rows.map(({ e, s }) => {
              const d = s.days.find((x) => x.date === today);
              return (
                <tr key={e.id} onClick={() => setSelected(e.id)} className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-muted/40">
                  <td className="p-3 font-medium">{e.name}<div className="text-xs text-muted-foreground">{e.role}</div></td>
                  <td className="p-3">{e.deviceUserId || <span className="text-xs text-muted-foreground">{t("غير مربوط بالبصمة")}</span>}</td>
                  <td className="p-3">{d ? <Badge variant="outline" className={d.late ? "border-warning/30 bg-warning/15 text-warning" : "border-success/30 bg-success/15 text-success"}>{d.in}{d.out ? ` → ${d.out}` : ""}</Badge> : "—"}</td>
                  <td className="p-3 font-bold">{s.present}</td>
                  <td className="p-3 text-warning">{s.late}</td>
                  <td className="p-3 text-destructive">{s.absent}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {sel && (
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 font-display text-lg font-bold">{sel.e.name} — {monthLabel(month)}</h2>
          {sel.s.days.length === 0 ? <p className="text-sm text-muted-foreground">{t("لا توجد بصمات")}</p> : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {sel.s.days.map((d) => (
                <div key={d.date} className={`rounded-lg border p-2 text-xs ${d.late ? "border-warning/40" : "border-border"}`}>
                  <div className="font-medium">{d.date}</div>
                  <div>{t("دخول")} {d.in}</div><div>{t("خروج")} {d.out ?? "—"}</div>
                  {d.late && <div className="text-warning">{t("تأخير")} {d.lateMin} {t("دقيقة")}</div>}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <h2 className="font-display text-lg font-bold">{t("أجهزة البصمة")}</h2>
        <div className="rounded-lg bg-muted/50 p-3 text-sm leading-7">
          <div className="font-medium">{t("إعداد جهاز ZKTeco")}:</div>
          <div>{t("القائمة ← الاتصال ← إعداد خادم السحابة (ADMS)")}</div>
          <div>{t("عنوان الخادم")}: <b dir="ltr">{origin}</b> — {t("المنفذ")}: <b>443</b> — HTTPS: {t("مفعل")}</div>
          <div>{t("بعد أول اتصال يظهر الجهاز هنا، اعتمده لبدء استقبال البصمات.")}</div>
        </div>
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
  );
}
