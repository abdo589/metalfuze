import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarOff, Clock, FileWarning, IdCard, UserCheck, UserX, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { daysLeft, ALERT_DAYS } from "@/lib/residency";
import { DOCS, useResidencies } from "@/lib/residency-data";
import { DocsOverview } from "@/components/DocsOverview";

export const Route = createFileRoute("/hr-dashboard")({
  head: () => ({
    meta: [
      { title: "لوحة التحكم — تنبيهات الموظفين | Metal Fuze" },
      { name: "description", content: "كل تنبيهات الموظفين في مكان واحد: الإقامات والوثائق والإجازات والحضور اليوم." },
      { property: "og:title", content: "لوحة التحكم — تنبيهات الموظفين" },
      { property: "og:description", content: "تنبيهات الإقامات والوثائق والإجازات والحضور لموظفي Metal Fuze." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HrDashboard,
});

type Alert = { level: "danger" | "warn" | "info"; title: string; detail: string; to: "/hr-file" | "/attendance"; days?: number };
type Rec = { sheet: string; data: Record<string, unknown> };

const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function toIso(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10);
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  return isNaN(Date.parse(s)) ? null : s.slice(0, 10);
}

function HrDashboard() {
  const { rows: res } = useResidencies();
  const [hr, setHr] = useState<Rec[]>([]);
  const [emps, setEmps] = useState<{ name: string; device_user_id: string | null; active: boolean }[]>([]);
  const [punches, setPunches] = useState<{ device_user_id: string; punched_at: string }[]>([]);

  useEffect(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    supabase.from("hr_records").select("sheet,data").then(({ data }) => setHr((data ?? []) as Rec[]));
    supabase.from("employees").select("name,device_user_id,active").then(({ data }) => setEmps(data ?? []));
    supabase.from("attendance_logs").select("device_user_id,punched_at").gte("punched_at", start.toISOString())
      .then(({ data }) => setPunches(data ?? []));
  }, []);

  const today = localDay();
  const alerts = useMemo(() => {
    const out: Alert[] = [];
    for (const r of res) for (const d of DOCS) {
      const x = daysLeft(r[d.key]);
      if (x === null || x > ALERT_DAYS) continue;
      out.push({ level: x < 0 ? "danger" : x <= 30 ? "warn" : "info", days: x, to: "/hr-file",
        title: `${d.label} — ${r.name}`, detail: x < 0 ? `منتهية منذ ${-x} يوم` : `تنتهي بعد ${x} يوم (${r[d.key]})` });
    }
    const names = new Map(hr.filter((r) => r.sheet === "employees").map((r) => [String(r.data["رقم الموظف"]), String(r.data["اسم الموظف"] ?? "")]));
    const who = (r: Rec) => names.get(String(r.data["رقم الموظف"])) || `موظف ${r.data["رقم الموظف"] ?? ""}`;
    for (const r of hr) {
      if (r.sheet === "documents") {
        const iso = toIso(r.data["تاريخ الانتهاء"]); const x = daysLeft(iso, today);
        if (x === null || x > ALERT_DAYS) continue;
        out.push({ level: x < 0 ? "danger" : x <= 30 ? "warn" : "info", days: x, to: "/hr-file",
          title: `${r.data["نوع الوثيقة"] ?? "وثيقة"} — ${who(r)}`, detail: x < 0 ? `منتهية منذ ${-x} يوم` : `تنتهي بعد ${x} يوم (${iso})` });
      }
      if (r.sheet === "leaves") {
        const a = toIso(r.data["تاريخ البداية"]), b = toIso(r.data["تاريخ النهاية"]);
        if (a && b && a <= today && today <= b)
          out.push({ level: "info", to: "/hr-file", title: `في إجازة — ${who(r)}`, detail: `${r.data["نوع الإجازة"] ?? ""} حتى ${b}` });
        else if (a && a > today && (daysLeft(a, today) ?? 99) <= 7)
          out.push({ level: "info", to: "/hr-file", title: `إجازة قادمة — ${who(r)}`, detail: `تبدأ ${a}` });
      }
    }
    return out.sort((p, q) => ({ danger: 0, warn: 1, info: 2 })[p.level] - ({ danger: 0, warn: 1, info: 2 })[q.level] || (p.days ?? 999) - (q.days ?? 999));
  }, [res, hr, today]);

  const active = emps.filter((e) => e.active);
  const first = new Map<string, Date>();
  for (const p of punches) { const d = new Date(p.punched_at); const f = first.get(p.device_user_id); if (!f || d < f) first.set(p.device_user_id, d); }
  const tracked = active.filter((e) => e.device_user_id);
  const present = tracked.filter((e) => first.has(e.device_user_id!));
  const late = present.filter((e) => { const d = first.get(e.device_user_id!)!; return d.getHours() * 60 + d.getMinutes() > 9 * 60 + 30; });
  const absent = tracked.filter((e) => !first.has(e.device_user_id!));
  const dangers = alerts.filter((a) => a.level === "danger").length;
  const tone = { danger: "border-destructive/50 bg-destructive/10", warn: "border-primary/50 bg-primary/10", info: "border-border bg-card" };

  const stats = [
    { label: "الموظفون النشطون", v: active.length, icon: Users },
    { label: "حاضرون اليوم", v: present.length, icon: UserCheck },
    { label: "متأخرون اليوم", v: late.length, icon: Clock },
    { label: "لم يسجلوا بعد", v: absent.length, icon: UserX },
    { label: "وثائق منتهية", v: dangers, icon: FileWarning },
    { label: "كل التنبيهات", v: alerts.length, icon: AlertTriangle },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <header className="text-center">
        <h1 className="font-display text-3xl font-extrabold sm:text-4xl">لوحة التحكم</h1>
        <p className="mt-1 text-sm text-muted-foreground">كل التنبيهات الخاصة بالموظفين — تتحدث تلقائيًا · {today}</p>
      </header>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4 text-center">
            <s.icon className="mx-auto size-5 text-primary" />
            <div className="mt-1 font-display text-2xl font-bold">{s.v}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="space-y-2 lg:col-span-2">
          <h2 className="flex items-center gap-2 font-bold"><IdCard className="size-4" /> الوثائق والانتهاءات</h2>
          <DocsOverview />
        </section>
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 font-bold"><Clock className="size-4" /> الحضور اليوم</h2>
          {[...late.map((e) => ({ e, t: `متأخر — ${first.get(e.device_user_id!)!.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`, c: tone.warn })),
            ...absent.map((e) => ({ e, t: "لم يسجل حضور", c: tone.info }))].map(({ e, t, c }) => (
            <Link key={e.name + t} to="/attendance" className={`block rounded-xl border p-3 hover:opacity-80 ${c}`}>
              <div className="font-medium">{e.name}</div><div className="text-xs text-muted-foreground">{t}</div>
            </Link>
          ))}
          {!tracked.length && (
            <p className="flex items-center gap-2 rounded-xl border border-border p-4 text-sm text-muted-foreground">
              <CalendarOff className="size-4 shrink-0" /> لا يوجد موظفون مربوطون برقم بصمة بعد
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
