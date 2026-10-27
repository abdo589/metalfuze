import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { t } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listUsers, type AppUser } from "@/lib/users.functions";
import { items } from "@/components/AppSidebar";
import { DAY_NAMES } from "@/lib/access-rules";

type Row = { user_id: string; blocked_paths: string[]; read_only: boolean; days: number[]; start_time: string; end_time: string; allowed_ips: string[]; devices: string[] };
const empty = (user_id: string): Row => ({ user_id, blocked_paths: [], read_only: false, days: [], start_time: "", end_time: "", allowed_ips: [], devices: [] });
const PAGES = [...items, { to: "/dev", label: "الأعطال وإعدادات الحسابات" }, { to: "/mail", label: "البريد (Outlook)" }, { to: "/executive", label: "الملخص التنفيذي" }, { to: "/accounting", label: "المحاسبة" }, { to: "/my-projects", label: "مشاريعي" }]
  .filter((p, i, a) => a.findIndex((x) => x.to === p.to) === i);

/** Developer-only: per-account pages, sign-in hours, places/devices and view-only mode. */
export function AccessControl() {
  const list = useServerFn(listUsers);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [sel, setSel] = useState("");
  const [row, setRow] = useState<Row | null>(null);
  const [ips, setIps] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { list().then(setUsers).catch(() => toast.error(t("تعذر تحميل المستخدمين"))); }, [list]);
  const load = useCallback(async (id: string) => {
    const { data } = await supabase.from("account_access").select("*").eq("user_id", id).maybeSingle();
    const r = (data as Row | null) ?? empty(id);
    setRow(r); setIps(r.allowed_ips.join("\n"));
  }, []);
  useEffect(() => { if (sel) load(sel); else setRow(null); }, [sel, load]);

  const toggle = <K extends "blocked_paths" | "days" | "devices">(k: K, v: Row[K][number]) =>
    setRow((r) => r && ({ ...r, [k]: (r[k] as unknown[]).includes(v) ? (r[k] as unknown[]).filter((x) => x !== v) : [...(r[k] as unknown[]), v] }));

  async function save() {
    if (!row) return;
    setBusy(true);
    const payload = { ...row, allowed_ips: ips.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean), updated_at: new Date().toISOString() };
    const { error } = await supabase.from("account_access").upsert(payload);
    setBusy(false);
    if (error) toast.error(t("تعذر الحفظ")); else toast.success(t("تم حفظ صلاحيات الدخول — تطبق خلال دقيقة"));
  }

  return (
    <div className="space-y-4 pt-3">
      <select className="w-full rounded-md border bg-background px-3 py-2 sm:w-80" value={sel} onChange={(e) => setSel(e.target.value)} aria-label={t("الحساب")}>
        <option value="">{t("اختر الحساب")}</option>
        {users.map((u) => <option key={u.id} value={u.id}>{u.name} — {u.username}</option>)}
      </select>
      {row && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="space-y-2 rounded-2xl border bg-card p-4">
            <h3 className="font-bold">{t("الصفحات المسموحة")}</h3>
            <p className="text-xs text-muted-foreground">{t("شيل العلامة عن أي صفحة عشان تتقفل على الحساب ده (فوق صلاحيات دوره).")}</p>
            <div className="grid gap-1 sm:grid-cols-2">
              {PAGES.map((p) => (
                <label key={p.to} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!row.blocked_paths.includes(p.to)} onChange={() => toggle("blocked_paths", p.to)} /> {t(p.label)}
                </label>
              ))}
            </div>
          </section>
          <div className="space-y-4">
            <section className="space-y-2 rounded-2xl border bg-card p-4">
              <h3 className="font-bold">{t("عرض أو تعديل")}</h3>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={row.read_only} onChange={(e) => setRow({ ...row, read_only: e.target.checked })} /> {t("عرض فقط (بدون تعديل)")}
              </label>
            </section>
            <section className="space-y-2 rounded-2xl border bg-card p-4">
              <h3 className="font-bold">{t("مواعيد الدخول")}</h3>
              <p className="text-xs text-muted-foreground">{t("بتوقيت الرياض. لو ما اخترتش أيام أو ساعات يبقى مفيش حد.")}</p>
              <div className="flex flex-wrap gap-2">
                {DAY_NAMES.map((d, i) => (
                  <label key={d} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={row.days.includes(i)} onChange={() => toggle("days", i)} /> {t(d)}</label>
                ))}
              </div>
              <div className="flex items-center gap-2 text-sm">
                {t("من")} <Input type="time" dir="ltr" className="w-32" value={row.start_time} onChange={(e) => setRow({ ...row, start_time: e.target.value })} />
                {t("إلى")} <Input type="time" dir="ltr" className="w-32" value={row.end_time} onChange={(e) => setRow({ ...row, end_time: e.target.value })} />
              </div>
            </section>
            <section className="space-y-2 rounded-2xl border bg-card p-4">
              <h3 className="font-bold">{t("أماكن وأجهزة مسموحة")}</h3>
              <p className="text-xs text-muted-foreground">{t("عناوين IP المسموحة (واحد في كل سطر، ويقبل * في الآخر). تلاقي IP المكتب في تبويب «الدخول والخروج». فاضي = من أي مكان.")}</p>
              <textarea className="min-h-20 w-full rounded-md border bg-background p-2 text-sm" dir="ltr" value={ips} onChange={(e) => setIps(e.target.value)} />
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-1"><input type="checkbox" checked={row.devices.includes("computer")} onChange={() => toggle("devices", "computer")} /> {t("كمبيوتر")}</label>
                <label className="flex items-center gap-1"><input type="checkbox" checked={row.devices.includes("mobile")} onChange={() => toggle("devices", "mobile")} /> {t("موبايل")}</label>
              </div>
              <p className="text-xs text-muted-foreground">{t("لو ما اخترتش نوع جهاز يبقى مسموح من الاتنين.")}</p>
            </section>
            <Button onClick={save} disabled={busy}><Save /> {t("حفظ")}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
