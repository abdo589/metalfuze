import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Bell, LogIn, LogOut, MapPin, Radar, UserX } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { t, useLanguage } from "@/lib/i18n";
import { usePayroll, monthKey } from "@/lib/payroll";
import { riyadh, type Punch } from "@/lib/attendance";
import { useMonthPunches } from "@/lib/attendance-data";
import { SelfieThumb, useSites } from "@/components/RemoteAttendance";
import type { LivePoint } from "@/components/LiveTrackMap";

const LiveTrackMap = lazy(() => import("@/components/LiveTrackMap"));

export const Route = createFileRoute("/attendance-tracking")({
  head: () => ({
    meta: [
      { title: "تتبع الحضور — Metal Fuze" },
      { name: "description", content: "متابعة لحظية لحضور وانصراف ومواقع الموظفين أثناء الدوام." },
      { property: "og:title", content: "تتبع الحضور — Metal Fuze" },
      { property: "og:description", content: "خريطة لحظية وسجل لكل موظف وتنبيهات فورية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Tracking,
});

type Ping = { employee_id: string; lat: number; lng: number; distance_m: number | null; pinged_at: string };
const todayStart = () => new Date(new Date(new Date().toISOString().slice(0, 10) + "T00:00:00+03:00").getTime()).toISOString();

function Tracking() {
  useLanguage();
  const employees = usePayroll().filter((e) => e.active);
  const { sites } = useSites();
  const [month, setMonth] = useState(monthKey());
  const punches = useMonthPunches(month);
  const [live, setLive] = useState<Punch[]>([]);
  const [pings, setPings] = useState<Ping[]>([]);
  const [sel, setSel] = useState("");
  const [trail, setTrail] = useState<Ping[]>([]);
  const empRef = useRef(employees);
  empRef.current = employees;

  const keyOf = (e: { id: string; deviceUserId?: string }) => e.deviceUserId || e.id;
  const nameOf = (uid: string) => empRef.current.find((e) => keyOf(e) === uid || e.id === uid)?.name ?? uid;

  // Today's latest location of everyone, then live inserts for punches and pings.
  useEffect(() => {
    supabase.from("location_pings").select("employee_id,lat,lng,distance_m,pinged_at").gte("pinged_at", todayStart())
      .order("pinged_at").limit(5000).then(({ data }) => data && setPings(data));
    const ch = supabase.channel(`track-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "attendance_logs" }, (p) => {
        const r = p.new as Punch;
        setLive((l) => [...l, r]);
        const msg = `${nameOf(r.device_user_id)}: ${r.status === 1 ? t("انصراف") : t("حضور")} ${riyadh(r.punched_at).time}${r.site_name ? " — " + r.site_name : ""}`;
        toast(msg);
        if ("Notification" in window && Notification.permission === "granted") new Notification("Metal Fuze", { body: msg, icon: "/icon-192.png" });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "location_pings" }, (p) => setPings((l) => [...l, p.new as Ping]))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const all = useMemo(() => {
    const seen = new Set(punches.map((p) => p.device_user_id + p.punched_at));
    return [...punches, ...live.filter((p) => !seen.has(p.device_user_id + p.punched_at))];
  }, [punches, live]);
  const today = riyadh(new Date().toISOString()).date;

  const rows = employees.map((e) => {
    const mine = all.filter((p) => p.device_user_id === keyOf(e) && riyadh(p.punched_at).date === today);
    const first = mine.find((p) => p.status !== 1) ?? mine[0];
    const last = mine[mine.length - 1];
    const onShift = !!last && last.status !== 1;
    const lastPing = [...pings].reverse().find((p) => p.employee_id === e.id);
    const pos = lastPing ?? (last?.lat != null ? { lat: last.lat!, lng: last.lng!, pinged_at: last.punched_at, distance_m: last.distance_m ?? null } : null);
    return { e, first, last, onShift, pos, out: mine.length > 0 && !onShift };
  });
  const points: LivePoint[] = rows.filter((r) => r.pos).map((r) => ({
    id: r.e.id, name: r.e.name, lat: r.pos!.lat, lng: r.pos!.lng, onShift: r.onShift,
    label: `${t("آخر تحديث")} ${riyadh(r.pos!.pinged_at).time}${r.pos!.distance_m != null ? ` · ${r.pos!.distance_m} ${t("متر")}` : ""}`,
  }));

  useEffect(() => {
    if (!sel) { setTrail([]); return; }
    supabase.from("location_pings").select("employee_id,lat,lng,distance_m,pinged_at").eq("employee_id", sel)
      .gte("pinged_at", todayStart()).order("pinged_at").limit(1000).then(({ data }) => setTrail(data ?? []));
  }, [sel, pings.length]);

  const selEmp = employees.find((e) => e.id === sel);
  const history = selEmp ? all.filter((p) => p.device_user_id === keyOf(selEmp)).sort((a, b) => b.punched_at.localeCompare(a.punched_at)) : [];
  const present = rows.filter((r) => r.onShift).length, left = rows.filter((r) => r.out).length;
  const [perm, setPerm] = useState<string>("default");
  useEffect(() => { if ("Notification" in window) setPerm(Notification.permission); }, []);

  return (
    <div className="space-y-5 p-4 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold"><Radar className="size-6" /> {t("تتبع الحضور")}</h1>
          <p className="text-sm text-muted-foreground">{t("متابعة لحظية لكل موظف: الحضور والانصراف ومكانه أثناء الدوام")}</p>
        </div>
        {perm !== "granted" && (
          <Button variant="outline" onClick={async () => setPerm(await Notification.requestPermission())}><Bell className="size-4" /> {t("تفعيل التنبيهات على الجهاز")}</Button>
        )}
      </header>

      <div className="grid grid-cols-3 gap-3">
        <Stat icon={<LogIn className="size-5 text-success" />} label={t("في الدوام الآن")} value={present} />
        <Stat icon={<LogOut className="size-5 text-warning" />} label={t("انصرفوا")} value={left} />
        <Stat icon={<UserX className="size-5 text-destructive" />} label={t("لم يسجلوا اليوم")} value={rows.length - present - left} />
      </div>

      <section className="space-y-2 rounded-xl border border-border bg-card p-4">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold"><MapPin className="size-5" /> {t("الخريطة اللحظية")}</h2>
        <ClientOnly fallback={<div className="h-[460px] rounded-lg bg-muted" />}>
          <Suspense fallback={<div className="h-[460px] rounded-lg bg-muted" />}>
            <LiveTrackMap sites={sites} points={sel ? points.filter((p) => p.id === sel) : points} trail={trail.map((p) => [p.lat, p.lng])} />
          </Suspense>
        </ClientOnly>
        <p className="text-xs text-muted-foreground">{t("الموقع يتحدث كل 3 دقائق طالما صفحة الحضور مفتوحة على جوال الموظف بعد تسجيل الحضور.")}</p>
      </section>

      <section className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground"><tr>
            <th className="p-3 text-start">{t("الموظف")}</th><th className="p-3 text-start">{t("الحالة")}</th>
            <th className="p-3 text-start">{t("حضور")}</th><th className="p-3 text-start">{t("انصراف")}</th>
            <th className="p-3 text-start">{t("آخر موقع")}</th><th className="p-3" />
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.e.id} className={`border-t border-border ${sel === r.e.id ? "bg-primary/5" : ""}`}>
                <td className="p-3 font-medium">{r.e.name}</td>
                <td className="p-3">{r.onShift ? <Badge className="bg-success text-success-foreground">{t("في الدوام")}</Badge>
                  : r.out ? <Badge variant="secondary">{t("انصرف")}</Badge> : <Badge variant="outline">{t("لم يسجل")}</Badge>}</td>
                <td className="p-3 tabular-nums">{r.first ? riyadh(r.first.punched_at).time : "—"}</td>
                <td className="p-3 tabular-nums">{r.out && r.last ? riyadh(r.last.punched_at).time : "—"}</td>
                <td className="p-3 text-xs text-muted-foreground">{r.pos ? `${riyadh(r.pos.pinged_at).time}${r.pos.distance_m != null ? ` · ${r.pos.distance_m} ${t("متر")}` : ""}` : "—"}</td>
                <td className="p-3"><Button size="sm" variant={sel === r.e.id ? "default" : "outline"} onClick={() => setSel(sel === r.e.id ? "" : r.e.id)}>{t("السجل")}</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {selEmp && (
        <section className="space-y-3 rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-bold">{t("سجل")} {selEmp.name}</h2>
            <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2" />
          </div>
          {history.length === 0 ? <p className="text-sm text-muted-foreground">{t("لا توجد بصمات في هذا الشهر")}</p> : (
            <ul className="divide-y divide-border">
              {history.map((p) => (
                <li key={p.punched_at} className="flex items-center gap-3 py-2 text-sm">
                  {p.status === 1 ? <LogOut className="size-4 text-warning" /> : <LogIn className="size-4 text-success" />}
                  <span className="w-24 tabular-nums">{riyadh(p.punched_at).date}</span>
                  <span className="w-14 tabular-nums font-bold">{riyadh(p.punched_at).time}</span>
                  <Badge variant="outline">{p.source === "remote" ? t("جوال") : t("جهاز")}</Badge>
                  <span className="text-muted-foreground">{p.site_name ?? ""}{p.distance_m != null ? ` · ${p.distance_m} ${t("متر")}` : ""}</span>
                  {p.photo_path && <span className="ms-auto"><SelfieThumb path={p.photo_path} /></span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">{icon} {label}</div>
      <div className="mt-1 font-display text-3xl font-bold tabular-nums">{value}</div>
    </div>
  );
}
