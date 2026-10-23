import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { t, locale } from "@/lib/i18n";
import { listUsers, type AppUser } from "@/lib/users.functions";

type Act = { id: string; user_id: string; actor_name: string; table_name: string; action: string; label: string; created_at: string };

const TABLE: Record<string, string> = {
  acct_sheets: "المحاسبة", company_documents: "الوثائق", department_managers: "مدراء الأقسام", direct_messages: "الرسائل",
  employees: "الموظفين", est_records: "المؤسسة", exec_snapshot: "المشاريع والمدفوعات", financial_guarantees: "الضمانات المالية",
  fleet_cars: "السيارات", custody_assets: "عهد الأجهزة", custody_moves: "حركات العهد", hr_records: "ملفات HR", late_excuses: "أعذار التأخير", leave_balance_adjustments: "أرصدة الإجازات",
  leave_requests: "الإجازات", leave_settings: "إعدادات الإجازات", leave_types: "أنواع الإجازات", mgr_projects: "مشاريع المدراء",
  mgr_reports: "تقارير المدراء", performance_reviews: "تقييم الأداء", project_files: "ملفات المشاريع", residencies: "الإقامات",
  sales_deals: "المبيعات", settlements: "المخالصات", traffic_violations: "المخالفات", work_sites: "مواقع العمل",
  attendance_logs: "الحضور", attendance_devices: "أجهزة البصمة",
};
const ACT: Record<string, string> = { insert: "إضافة", update: "تعديل", delete: "حذف" };
const fmt = (d: string) => new Date(d).toLocaleString(locale(), { timeZone: "Asia/Riyadh" });

/** Periodic follow-up of every other account: report, per-account status, full activity log. */
export function ActivityMonitor() {
  const list = useServerFn(listUsers);
  const [period, setPeriod] = useState<"day" | "week">("day");
  const [rows, setRows] = useState<Act[] | null>(null);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [logins, setLogins] = useState<{ user_id: string; suspicious: boolean }[]>([]);
  const [bugs, setBugs] = useState<{ reporter_name: string }[]>([]);
  const [q, setQ] = useState("");
  const [who, setWho] = useState("");

  const load = useCallback(async () => {
    setRows(null);
    const since = new Date(Date.now() - (period === "day" ? 1 : 7) * 864e5).toISOString();
    list().then(setUsers).catch(() => {});
    const [a, l, b] = await Promise.all([
      supabase.from("activity_log").select("*").gte("created_at", since).order("created_at", { ascending: false }).limit(2000),
      supabase.from("login_events").select("user_id, suspicious").eq("event", "login").gte("created_at", since),
      supabase.from("bug_reports").select("reporter_name").gte("created_at", since),
    ]);
    setRows((a.data as Act[]) ?? []);
    setLogins((l.data as { user_id: string; suspicious: boolean }[]) ?? []);
    setBugs((b.data as { reporter_name: string }[]) ?? []);
  }, [list, period]);
  useEffect(() => { void load(); }, [load]);

  const acts = rows ?? [];
  const byTable = useMemo(() => {
    const m = new Map<string, number>();
    acts.forEach((r) => m.set(r.table_name, (m.get(r.table_name) ?? 0) + 1));
    return [...m].sort((x, y) => y[1] - x[1]);
  }, [acts]);

  const board = users.map((u) => {
    const mine = acts.filter((r) => r.user_id === u.id);
    return {
      u, count: mine.length, last: mine[0]?.created_at,
      logins: logins.filter((l) => l.user_id === u.id).length,
      sus: logins.filter((l) => l.user_id === u.id && l.suspicious).length,
      bugs: bugs.filter((b) => b.reporter_name === u.name).length,
    };
  }).sort((a, b) => b.count - a.count);

  const shown = acts.filter((r) => (!who || r.user_id === who) && (!q.trim() ||
    [r.actor_name, r.label, t(TABLE[r.table_name] ?? r.table_name), t(ACT[r.action] ?? r.action)].join(" ").toLowerCase().includes(q.trim().toLowerCase())));

  const count = (a: string) => acts.filter((r) => r.action === a).length;

  return (
    <div className="space-y-5 pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant={period === "day" ? "secondary" : "ghost"} onClick={() => setPeriod("day")}>{t("آخر 24 ساعة")}</Button>
        <Button size="sm" variant={period === "week" ? "secondary" : "ghost"} onClick={() => setPeriod("week")}>{t("آخر 7 أيام")}</Button>
        <Button size="sm" variant="outline" className="ms-auto" onClick={() => void load()}><RefreshCw /> {t("تحديث")}</Button>
      </div>

      <section className="space-y-2">
        <h2 className="font-bold">{t(period === "day" ? "التقرير اليومي" : "التقرير الأسبوعي")}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {([["كل العمليات", acts.length], ["إضافة", count("insert")], ["تعديل", count("update")], ["حذف", count("delete")], ["مرات الدخول", logins.length]] as const).map(([k, v]) => (
            <div key={k} className="rounded-2xl border bg-card p-4">
              <div className="text-xs text-muted-foreground">{t(k)}</div>
              <div className="mt-1 text-xl font-bold">{rows ? v : "…"}</div>
            </div>
          ))}
        </div>
        {!!byTable.length && (
          <div className="flex flex-wrap gap-2 text-sm">
            {byTable.map(([k, v]) => <span key={k} className="rounded-full border bg-muted px-3 py-1">{t(TABLE[k] ?? k)}: <b>{v}</b></span>)}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-bold">{t("حالة كل حساب")}</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground"><tr>
              {["الحساب", "آخر دخول", "آخر نشاط", "العمليات", "مرات الدخول", "دخول مريب", "الأعطال"].map((h) => <th key={h} className="p-2 text-start">{t(h)}</th>)}
            </tr></thead>
            <tbody>
              {board.map((b) => (
                <tr key={b.u.id} className={`cursor-pointer border-t hover:bg-muted/50 ${b.u.banned ? "opacity-60" : ""}`} onClick={() => setWho(b.u.id === who ? "" : b.u.id)}>
                  <td className="p-2 font-medium">{b.u.name}{b.u.id === who && " ●"}</td>
                  <td className="whitespace-nowrap p-2">{b.u.lastSignIn ? fmt(b.u.lastSignIn) : t("لم يدخل بعد")}</td>
                  <td className="whitespace-nowrap p-2">{b.last ? fmt(b.last) : "—"}</td>
                  <td className="p-2">{b.count}</td>
                  <td className="p-2">{b.logins}</td>
                  <td className={`p-2 ${b.sus ? "font-bold text-destructive" : ""}`}>{b.sus}</td>
                  <td className="p-2">{b.bugs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-bold">{t("سجل النشاط")}</h2>
        <div className="flex gap-2">
          <Input placeholder={t("بحث")} value={q} onChange={(e) => setQ(e.target.value)} />
          {who && <Button variant="ghost" onClick={() => setWho("")}>{t("كل الحسابات")}</Button>}
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground"><tr>
              {["الوقت", "الحساب", "العملية", "القسم", "العنصر"].map((h) => <th key={h} className="p-2 text-start">{t(h)}</th>)}
            </tr></thead>
            <tbody>
              {rows === null ? <tr><td colSpan={5} className="p-4 text-center">{t("جاري التحميل...")}</td></tr>
                : !shown.length ? <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">{t("لا توجد سجلات بعد")}</td></tr>
                : shown.slice(0, 500).map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="whitespace-nowrap p-2">{fmt(r.created_at)}</td>
                    <td className="p-2">{r.actor_name || "—"}</td>
                    <td className={`p-2 font-semibold ${r.action === "delete" ? "text-destructive" : ""}`}>{t(ACT[r.action] ?? r.action)}</td>
                    <td className="p-2">{t(TABLE[r.table_name] ?? r.table_name)}</td>
                    <td className="p-2" dir="auto">{r.label || "—"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
