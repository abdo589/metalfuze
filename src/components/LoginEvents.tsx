import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { t, locale } from "@/lib/i18n";

type Row = { id: string; user_name: string; event: string; ip: string; country: string; region: string; city: string; device: string; created_at: string };

function deviceLabel(ua: string) {
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "—";
  const br = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "";
  return `${os}${br ? " · " + br : ""}`;
}

export function LoginEvents() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState("");
  const load = useCallback(async () => {
    const { data } = await supabase.from("login_events").select("*").order("created_at", { ascending: false }).limit(500);
    setRows((data as Row[]) ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (rows ?? []).filter((r) => !s || [r.user_name, r.ip, r.country, r.city, r.region].join(" ").toLowerCase().includes(s));
  }, [rows, q]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input placeholder={t("بحث بالاسم أو IP أو المدينة")} value={q} onChange={(e) => setQ(e.target.value)} />
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
                <tr key={r.id} className="border-t">
                  <td className="whitespace-nowrap p-2">{new Date(r.created_at).toLocaleString(locale(), { timeZone: "Asia/Riyadh" })}</td>
                  <td className="p-2">{r.user_name}</td>
                  <td className="p-2"><span className={r.event === "login" ? "text-primary font-semibold" : "text-destructive font-semibold"}>{t(r.event === "login" ? "دخول" : "خروج")}</span></td>
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
