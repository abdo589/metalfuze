import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { t, locale } from "@/lib/i18n";
import { deviceLabel } from "@/lib/login-risk";

type Row = { id: string; user_id: string; user_name: string; event: string; ip: string; country: string; city: string; device: string; created_at: string; suspicious: boolean };
type Session = { login?: Row; logout?: Row };

const fmt = (d: string) => new Date(d).toLocaleString(locale(), { timeZone: "Asia/Riyadh" });
function dur(a: string, b: string) {
  const m = Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000));
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}

/** Each account's sign-ins and sign-outs paired into sessions. */
export function EmployeeLogins() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [uid, setUid] = useState("");
  const load = useCallback(async () => {
    const { data } = await supabase.from("login_events").select("*").order("created_at", { ascending: true }).limit(2000);
    setRows((data as Row[]) ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const people = useMemo(() => {
    const m = new Map<string, { name: string; count: number; last: string }>();
    for (const r of rows ?? []) m.set(r.user_id, { name: r.user_name || "—", count: (m.get(r.user_id)?.count ?? 0) + (r.event === "login" ? 1 : 0), last: r.created_at });
    return [...m.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));
  }, [rows]);
  useEffect(() => { if (!uid && people[0]) setUid(people[0][0]); }, [people, uid]);

  const sessions = useMemo(() => {
    const out: Session[] = [];
    for (const r of (rows ?? []).filter((x) => x.user_id === uid)) {
      if (r.event === "login") out.push({ login: r });
      else if (out.length && out[out.length - 1].login && !out[out.length - 1].logout) out[out.length - 1].logout = r;
      else out.push({ logout: r });
    }
    return out.reverse();
  }, [rows, uid]);

  return (
    <div className="space-y-3 pt-3">
      <div className="flex flex-wrap gap-2">
        <select className="flex-1 rounded-md border bg-background px-2 py-2" value={uid} onChange={(e) => setUid(e.target.value)}>
          {people.map(([id, p]) => <option key={id} value={id}>{p.name} ({p.count})</option>)}
        </select>
        <Button variant="outline" onClick={() => void load()}><RefreshCw /> {t("تحديث")}</Button>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>{["الدخول", "الخروج", "المدة", "IP", "المنطقة", "الجهاز"].map((h) => <th key={h} className="p-2 text-start">{t(h)}</th>)}</tr>
          </thead>
          <tbody>
            {rows === null ? <tr><td colSpan={6} className="p-4 text-center">{t("جاري التحميل...")}</td></tr>
              : sessions.length === 0 ? <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">{t("لا توجد سجلات بعد")}</td></tr>
              : sessions.map((s, i) => {
                const r = (s.login ?? s.logout)!;
                return (
                  <tr key={i} className={`border-t ${s.login?.suspicious ? "bg-destructive/10" : ""}`}>
                    <td className="whitespace-nowrap p-2 text-primary">{s.login ? fmt(s.login.created_at) : "—"}</td>
                    <td className="whitespace-nowrap p-2 text-destructive">{s.logout ? fmt(s.logout.created_at) : s.login ? t("لم يسجل خروج") : "—"}</td>
                    <td className="p-2 font-mono" dir="ltr">{s.login && s.logout ? dur(s.login.created_at, s.logout.created_at) : "—"}</td>
                    <td className="p-2 font-mono" dir="ltr">{r.ip || "—"}</td>
                    <td className="p-2">{[r.city, r.country].filter(Boolean).join("، ") || "—"}</td>
                    <td className="p-2" title={r.device}>{deviceLabel(r.device)}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
