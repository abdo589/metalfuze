import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { t, locale } from "@/lib/i18n";

/** Quick health cards for the developer. */
export function DevHealth({ bannedCount }: { bannedCount: number | null }) {
  const [s, setS] = useState<Record<string, string | number> | null>(null);
  const load = useCallback(async () => {
    const day = new Date(); day.setHours(0, 0, 0, 0);
    const week = new Date(Date.now() - 7 * 864e5).toISOString();
    const [open, auto, dev, sus, active] = await Promise.all([
      supabase.from("bug_reports").select("id", { count: "exact", head: true }).neq("status", "fixed"),
      supabase.from("bug_reports").select("id", { count: "exact", head: true }).eq("kind", "auto").gte("created_at", day.toISOString()),
      supabase.from("attendance_devices").select("last_seen").order("last_seen", { ascending: false, nullsFirst: false }).limit(1),
      supabase.from("login_events").select("id", { count: "exact", head: true }).eq("suspicious", true).gte("created_at", week),
      supabase.from("login_events").select("user_id").eq("event", "login").gte("created_at", day.toISOString()),
    ]);
    const last = dev.data?.[0]?.last_seen as string | null | undefined;
    const hrs = last ? Math.round((Date.now() - new Date(last).getTime()) / 36e5) : null;
    setS({
      open: open.count ?? 0, auto: auto.count ?? 0, sus: sus.count ?? 0,
      active: new Set((active.data ?? []).map((r) => r.user_id)).size,
      device: last == null ? t("لم يتصل أبدًا") : hrs! < 1 ? t("متصل") : `${t("غير متصل منذ")} ${hrs} ${t("ساعة")}`,
    });
  }, []);
  useEffect(() => { void load(); }, [load]);
  const cards: [string, string | number | undefined][] = [
    ["الأعطال المفتوحة", s?.open], ["أخطاء تلقائية اليوم", s?.auto], ["جهاز البصمة", s?.device],
    ["دخول مريب (7 أيام)", s?.sus], ["حسابات نشطة اليوم", s?.active], ["حسابات موقوفة", bannedCount ?? "…"],
  ];
  return (
    <div className="space-y-3 pt-3">
      <Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw /> {t("تحديث")}</Button>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cards.map(([k, v]) => (
          <div key={k} className="rounded-2xl border bg-card p-4">
            <div className="text-xs text-muted-foreground">{t(k)}</div>
            <div className="mt-1 text-xl font-bold">{v ?? "…"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const ACTION: Record<string, string> = {
  create: "إنشاء حساب", delete: "حذف حساب", role: "تغيير صلاحية", password: "تغيير كلمة السر",
  ban: "إيقاف", unban: "تفعيل", force_logout: "خروج إجباري",
};
type Audit = { id: string; actor_name: string; target_name: string; action: string; details: string; created_at: string };

export function AccountAudit() {
  const [rows, setRows] = useState<Audit[] | null>(null);
  const [q, setQ] = useState("");
  const load = useCallback(async () => {
    const { data } = await supabase.from("account_audit").select("*").order("created_at", { ascending: false }).limit(500);
    setRows((data as Audit[]) ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const shown = useMemo(() => {
    const k = q.trim().toLowerCase();
    return (rows ?? []).filter((r) => !k || [r.actor_name, r.target_name, r.details, t(ACTION[r.action] ?? r.action)].join(" ").toLowerCase().includes(k));
  }, [rows, q]);
  return (
    <div className="space-y-3 pt-3">
      <div className="flex gap-2">
        <Input placeholder={t("بحث")} value={q} onChange={(e) => setQ(e.target.value)} />
        <Button variant="outline" onClick={() => void load()}><RefreshCw /> {t("تحديث")}</Button>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>{["الوقت", "بواسطة", "الحساب", "العملية", "التفاصيل"].map((h) => <th key={h} className="p-2 text-start">{t(h)}</th>)}</tr>
          </thead>
          <tbody>
            {rows === null ? <tr><td colSpan={5} className="p-4 text-center">{t("جاري التحميل...")}</td></tr>
              : !shown.length ? <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">{t("لا توجد سجلات بعد")}</td></tr>
              : shown.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="whitespace-nowrap p-2">{new Date(r.created_at).toLocaleString(locale(), { timeZone: "Asia/Riyadh" })}</td>
                  <td className="p-2">{r.actor_name}</td>
                  <td className="p-2">{r.target_name || "—"}</td>
                  <td className="p-2 font-semibold">{t(ACTION[r.action] ?? r.action)}</td>
                  <td className="p-2" dir="auto">{r.details || "—"}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
