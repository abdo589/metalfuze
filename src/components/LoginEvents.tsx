import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { t, locale } from "@/lib/i18n";
import { deviceLabel } from "@/lib/login-risk";

type Row = { id: string; user_name: string; event: string; ip: string; country: string; region: string; city: string; device: string; created_at: string; suspicious: boolean; reason: string };

export function LoginEvents() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState("");
  const [onlySus, setOnlySus] = useState(false);
  const load = useCallback(async () => {
    const { data } = await supabase.from("login_events").select("*").order("created_at", { ascending: false }).limit(500);
    setRows((data as Row[]) ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (rows ?? []).filter((r) => (!onlySus || r.suspicious) && (!s || [r.user_name, r.ip, r.country, r.city, r.region].join(" ").toLowerCase().includes(s)));
  }, [rows, q, onlySus]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Input className="flex-1" placeholder={t("بحث بالاسم أو IP أو المدينة")} value={q} onChange={(e) => setQ(e.target.value)} />
        <Button variant={onlySus ? "destructive" : "outline"} onClick={() => setOnlySus((v) => !v)}><ShieldAlert /> {t("المريب فقط")}</Button>
        <Button variant="outline" onClick={() => void load()}><RefreshCw /> {t("تحديث")}</Button>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>{["الوقت", "الحساب", "العملية", "IP", "المنطقة", "الجهاز"].map((h) => <th key={h} className="p-2 text-start">{t(h)}</th>)}</tr>
          </thead>
          <tbody>
            {rows === null ? <tr><td colSpan={6} className="p-4 text-center">{t("جاري التحميل...")}</td></tr>
              : shown.length === 0 ? <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">{t("لا توجد سجلات بعد")}</td></tr>
              : shown.map((r) => (
                <tr key={r.id} className={`border-t ${r.suspicious ? "bg-destructive/10" : ""}`}>
                  <td className="whitespace-nowrap p-2">{new Date(r.created_at).toLocaleString(locale(), { timeZone: "Asia/Riyadh" })}</td>
                  <td className="p-2">{r.user_name}</td>
                  <td className="p-2">
                    <span className={r.event === "login" ? "text-primary font-semibold" : "text-destructive font-semibold"}>{t(r.event === "login" ? "دخول" : "خروج")}</span>
                    {r.suspicious && <span className="ms-2 rounded-full bg-destructive px-2 py-0.5 text-xs text-destructive-foreground" title={r.reason}>{t("مريب")} · {t(r.reason)}</span>}
                  </td>
                  <td className="p-2 font-mono" dir="ltr">{r.ip || "—"}</td>
                  <td className="p-2">{[r.city, r.region, r.country].filter(Boolean).join("، ") || "—"}</td>
                  <td className="p-2" title={r.device}>{deviceLabel(r.device)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
