import { useEffect, useState } from "react";
import { Copy, Crosshair, MapPin, MessageCircle, RefreshCw, Smartphone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { t, useLanguage } from "@/lib/i18n";
import { getPosition } from "@/lib/checkin-client";
import { payrollStore, type Employee } from "@/lib/payroll";

export type Site = { id: string; name: string; lat: number; lng: number; radius_m: number };

export function useSites() {
  const [sites, setSites] = useState<Site[]>([]);
  const load = async () => {
    const { data } = await supabase.from("work_sites").select("id,name,lat,lng,radius_m").order("created_at");
    if (data) setSites(data);
  };
  useEffect(() => { load(); }, []);
  return { sites, reload: load };
}

/** Parses "24.71, 46.67" or a Google Maps link containing @lat,lng or q=lat,lng. */
function parseCoords(s: string) {
  const m = /(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/.exec(s);
  return m ? { lat: Number(m[1]), lng: Number(m[2]) } : null;
}

export function WorkSites({ canEdit, sites, reload }: { canEdit: boolean; sites: Site[]; reload: () => void }) {
  useLanguage();
  const [name, setName] = useState("");
  const [coords, setCoords] = useState("");
  const [radius, setRadius] = useState("150");

  async function add() {
    const c = parseCoords(coords);
    if (!name.trim() || !c) return toast.error(t("اكتب اسم الموقع والإحداثيات"));
    const { error } = await supabase.from("work_sites").insert({ name: name.trim(), ...c, radius_m: Math.max(30, Number(radius) || 150) });
    if (error) return toast.error(error.message);
    setName(""); setCoords(""); toast.success(t("تمت إضافة الموقع")); reload();
  }

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold"><MapPin className="size-5" /> {t("مواقع العمل")}</h2>
      <p className="text-sm text-muted-foreground">{t("الحضور من الجوال يُقبل فقط داخل المسافة المسموحة من موقع عمل الموظف.")}</p>
      {sites.length === 0 && <p className="text-sm text-muted-foreground">{t("لا توجد مواقع بعد")}</p>}
      {sites.map((s) => (
        <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
          <div>
            <div className="font-medium">{s.name}</div>
            <a className="text-xs text-muted-foreground underline" dir="ltr" target="_blank" rel="noreferrer" href={`https://maps.google.com/?q=${s.lat},${s.lng}`}>
              {s.lat.toFixed(5)}, {s.lng.toFixed(5)}
            </a>
            <span className="text-xs text-muted-foreground"> · {s.radius_m} {t("متر")}</span>
          </div>
          {canEdit && <Button variant="ghost" size="icon" aria-label={t("حذف")} onClick={async () => {
            if (!confirm(`${t("حذف")} ${s.name}?`)) return;
            const { error } = await supabase.from("work_sites").delete().eq("id", s.id);
            if (error) toast.error(error.message); else { reload(); payrollStore.refresh(); }
          }}><Trash2 className="size-4 text-destructive" /></Button>}
        </div>
      ))}
      {canEdit && (
        <div className="grid gap-2 rounded-lg bg-muted/50 p-3 sm:grid-cols-[1fr_1.4fr_6rem_auto_auto]">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("اسم الموقع (مثلاً: مكتب الإدارة)")} />
          <Input value={coords} onChange={(e) => setCoords(e.target.value)} dir="ltr" placeholder={t("الإحداثيات أو رابط خرائط جوجل")} />
          <Input value={radius} onChange={(e) => setRadius(e.target.value)} type="number" min={30} aria-label={t("المسافة المسموحة (متر)")} />
          <Button variant="outline" onClick={async () => {
            try { const p = await getPosition(); setCoords(`${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`); }
            catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
          }}><Crosshair /> {t("موقعي الحالي")}</Button>
          <Button onClick={add}>{t("إضافة موقع")}</Button>
        </div>
      )}
    </section>
  );
}

export function RemoteLinks({ canEdit, employees, sites }: { canEdit: boolean; employees: Employee[]; sites: Site[] }) {
  useLanguage();
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const link = (e: Employee) => `${origin}/checkin/${e.checkinToken}`;
  const update = async (id: string, patch: { site_id?: string | null; checkin_token?: string | null }) => {
    const { error } = await supabase.from("employees").update(patch).eq("id", id);
    if (error) toast.error(error.message); else await payrollStore.refresh();
  };
  const newToken = () => Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => b.toString(16).padStart(2, "0")).join("");

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold"><Smartphone className="size-5" /> {t("الحضور من الجوال")}</h2>
      <p className="text-sm text-muted-foreground">{t("لكل موظف رابط شخصي يفتحه من جواله لتسجيل الحضور والانصراف بصورة سيلفي وموقعه.")}</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead><tr className="border-b border-border text-right text-xs text-muted-foreground">
            <th className="p-2 font-medium">{t("الموظف")}</th><th className="p-2 font-medium">{t("موقع العمل")}</th><th className="p-2 font-medium">{t("الرابط الشخصي")}</th>
          </tr></thead>
          <tbody>
            {employees.filter((e) => e.active).map((e) => (
              <tr key={e.id} className="border-b border-border/60 last:border-0">
                <td className="p-2 font-medium">{e.name}</td>
                <td className="p-2">
                  <select disabled={!canEdit} value={e.siteId ?? ""} onChange={(ev) => update(e.id, { site_id: ev.target.value || null })}
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm">
                    <option value="">{t("— بدون موقع —")}</option>
                    {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </td>
                <td className="p-2">
                  {!e.checkinToken ? <span className="text-xs text-muted-foreground">{t("الرابط موقوف")}</span> : canEdit ? (
                    <div className="flex flex-wrap gap-1">
                      <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(link(e)); toast.success(t("تم نسخ الرابط")); }}><Copy /> {t("نسخ")}</Button>
                      <Button size="sm" variant="outline" asChild>
                        <a target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`${t("رابط تسجيل الحضور الخاص بك")}: ${link(e)}`)}`}><MessageCircle /> WhatsApp</a>
                      </Button>
                    </div>
                  ) : <span className="text-xs text-muted-foreground">{t("مفعل")}</span>}
                  {canEdit && (
                    <div className="mt-1 flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => { if (confirm(t("إنشاء رابط جديد؟ الرابط القديم سيتوقف."))) update(e.id, { checkin_token: newToken() }); }}><RefreshCw /> {t("رابط جديد")}</Button>
                      {e.checkinToken && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => update(e.id, { checkin_token: null })}>{t("إيقاف")}</Button>}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Small selfie thumbnail fetched through a short-lived signed link. */
export function SelfieThumb({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    supabase.storage.from("attendance-selfies").createSignedUrl(path, 600).then(({ data }) => setUrl(data?.signedUrl ?? null));
  }, [path]);
  if (!url) return <div className="size-12 rounded-md bg-muted" />;
  return <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="selfie" className="size-12 rounded-md object-cover" /></a>;
}
