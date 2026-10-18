import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, CalendarPlus, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import logoAsset from "@/assets/metal-fuze-logo.png.asset.json";
import logoLightAsset from "@/assets/metal-fuze-logo-light.png.asset.json";
import { LanguageToggle } from "@/components/LanguageToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { currentLanguage, t, useLanguage } from "@/lib/i18n";
import { countLeaveDays, leaveError, returnDate, stateLabel, type LeaveType } from "@/lib/leave-engine";

export const Route = createFileRoute("/leave/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "طلب إجازة — Metal Fuze" },
      { name: "description", content: "تقديم طلبات الإجازة ومتابعة الرصيد لموظفي Metal Fuze." },
      { property: "og:title", content: "طلب إجازة — Metal Fuze" },
      { property: "og:description", content: "قدّم طلب إجازتك وتابع حالته ورصيدك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LeaveLink,
});

type Req = { id: string; request_no: number; type_id: string; start_date: string; end_date: string; working_days: number; return_date: string | null; reason: string; status: string; manager_note: string | null; hr_note: string | null; attachment_name: string | null };
type Info = {
  name: string; dept: string; role: string; types: LeaveType[]; requests: Req[]; weekend: number[];
  balance: { entitlement: number; earned: number; used: number; booked: number; remaining: number; opening: number; adjustments: number } | null;
  notifications: { id: string; message: string; created_at: string }[];
};

const TONE: Record<string, string> = {
  approved: "border-success/50 bg-success/10 text-success", rejected: "border-destructive/50 bg-destructive/10 text-destructive",
  cancelled: "border-border text-muted-foreground", pending_manager: "border-warning/50 bg-warning/10 text-warning",
  pending_hr: "border-primary/50 bg-primary/10 text-primary", draft: "border-border",
};

function toB64(f: File): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1] ?? ""); r.onerror = rej; r.readAsDataURL(f); });
}

function LeaveLink() {
  useLanguage();
  const lang = currentLanguage();
  const { token } = Route.useParams();
  const [info, setInfo] = useState<Info | null | "invalid">(null);
  const [form, setForm] = useState({ type: "annual", start: "", end: "", reason: "" });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/public/leave?token=${encodeURIComponent(token)}`).then(async (r) => setInfo(r.ok ? await r.json() : "invalid")).catch(() => setInfo("invalid"));
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const info2 = info && info !== "invalid" ? info : null;
  const type = info2?.types.find((x) => x.id === form.type);
  const days = useMemo(() => (info2 && form.start && form.end && form.end >= form.start ? countLeaveDays(form.start, form.end, info2.weekend, type?.calendar_days) : 0), [info2, form, type]);
  const name = (x?: LeaveType) => (x ? (lang === "en" ? x.name_en : x.name_ar) : "");

  async function submit(): Promise<unknown> {
    if (!info2 || !type) return;
    if (!form.start || !form.end) return toast.error(t("اختر تاريخ البداية والنهاية"));
    if (form.end < form.start) return toast.error(t("تاريخ النهاية قبل تاريخ البداية"));
    if (type.requires_attachment && !file) return toast.error(t("هذا النوع يحتاج مرفقًا (مثل التقرير الطبي)"));
    if (type.uses_balance && info2.balance && days > info2.balance.remaining) return toast.error(t("الرصيد المتبقي لا يكفي لهذا الطلب"));
    if (file && file.size > 5 * 1024 * 1024) return toast.error(t("الملف أكبر من 5 ميجابايت"));
    setBusy(true);
    try {
      const attachment = file ? { name: file.name, type: file.type, data: await toB64(file) } : undefined;
      const r = await fetch("/api/public/leave", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, action: "create", ...form, attachment }) });
      const b = await r.json();
      if (!b.ok) toast.error(t(b.error === "filetype" ? "نوع الملف غير مدعوم (PDF أو صورة)" : leaveError(b.error)));
      else { toast.success(t("تم إرسال الطلب إلى المدير")); setForm({ ...form, start: "", end: "", reason: "" }); setFile(null); load(); }
    } finally { setBusy(false); }
  }

  async function cancel(id: string) {
    const r = await fetch("/api/public/leave", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, action: "cancel", id }) });
    const b = await r.json();
    if (!b.ok) toast.error(t(leaveError(b.error))); else { toast.success(t("تم إلغاء الطلب")); load(); }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <img src={logoAsset.url} alt="Metal Fuze" className="hidden h-9 dark:block" />
        <img src={logoLightAsset.url} alt="Metal Fuze" className="h-9 dark:hidden" />
        <LanguageToggle />
      </header>
      <main className="mx-auto max-w-2xl space-y-4 p-4">
        {info === null && <p className="py-10 text-center text-muted-foreground">{t("جارٍ التحميل…")}</p>}
        {info === "invalid" && <p className="py-10 text-center text-destructive">{t("الرابط غير صالح")}</p>}
        {info2 && <>
          <div>
            <h1 className="font-display text-2xl font-bold">{t("طلب إجازة")}</h1>
            <p className="text-sm text-muted-foreground">{info2.name} · {info2.role} · {info2.dept}</p>
          </div>

          {info2.balance && (
            <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[["الرصيد المتبقي", info2.balance.remaining], ["الاستحقاق السنوي", info2.balance.entitlement], ["المستخدم", info2.balance.used], ["المحجوز", info2.balance.booked]].map(([l, v]) => (
                <div key={l as string} className="rounded-xl border border-border bg-card p-3">
                  <div className="text-xs text-muted-foreground">{t(l as string)}</div>
                  <div className="font-display text-xl font-bold tabular-nums">{Number(v).toLocaleString("en-US", { maximumFractionDigits: 1 })}</div>
                </div>
              ))}
            </section>
          )}

          <section className="space-y-3 rounded-xl border border-border bg-card p-4">
            <h2 className="flex items-center gap-2 font-bold"><CalendarPlus className="size-4" /> {t("طلب جديد")}</h2>
            <label className="block text-sm">{t("نوع الإجازة")}
              <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-2" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {info2.types.map((x) => <option key={x.id} value={x.id}>{name(x)}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-sm">{t("تاريخ البداية")}<Input type="date" className="mt-1" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} /></label>
              <label className="text-sm">{t("تاريخ النهاية")}<Input type="date" className="mt-1" value={form.end} min={form.start} onChange={(e) => setForm({ ...form, end: e.target.value })} /></label>
            </div>
            {days > 0 && <p className="text-sm text-muted-foreground">{t("عدد الأيام")}: <b className="text-foreground">{days}</b> · {t("تاريخ العودة")}: <b className="text-foreground">{returnDate(form.end, info2.weekend)}</b></p>}
            <label className="block text-sm">{t("سبب الإجازة")}<Textarea className="mt-1" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Paperclip className="size-4" /> {file ? file.name : t(type?.requires_attachment ? "إرفاق مستند (مطلوب)" : "إرفاق مستند (اختياري)")}
              <input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
            <Button className="w-full" disabled={busy} onClick={submit}>{busy ? t("جارٍ الإرسال…") : t("إرسال الطلب")}</Button>
          </section>

          {info2.notifications.length > 0 && (
            <section className="space-y-1 rounded-xl border border-border bg-card p-4">
              <h2 className="flex items-center gap-2 font-bold"><Bell className="size-4" /> {t("الإشعارات")}</h2>
              {info2.notifications.map((n) => { const [no, tn, st] = n.message.split("|"); return (
                <div key={n.id} className="text-sm">{no} · {tn} · <b>{stateLabel(st ?? "", lang)}</b> <span className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString("en-GB")}</span></div>
              ); })}
            </section>
          )}

          <section className="space-y-2">
            <h2 className="font-bold">{t("طلباتي")}</h2>
            {info2.requests.length === 0 && <p className="text-sm text-muted-foreground">{t("لا توجد طلبات بعد")}</p>}
            {info2.requests.map((r) => (
              <div key={r.id} className="rounded-xl border border-border bg-card p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <b>#{r.request_no} · {name(info2.types.find((x) => x.id === r.type_id)) || r.type_id}</b>
                  <Badge variant="outline" className={TONE[r.status]}>{stateLabel(r.status, lang)}</Badge>
                </div>
                <div className="text-muted-foreground">{r.start_date} → {r.end_date} · {r.working_days} {t("يوم")}</div>
                {(r.manager_note || r.hr_note) && <div className="mt-1 text-xs">{r.manager_note && <>{t("ملاحظة المدير")}: {r.manager_note} </>}{r.hr_note && <>· HR: {r.hr_note}</>}</div>}
                {["draft", "pending_manager", "pending_hr"].includes(r.status) && (
                  <Button size="sm" variant="outline" className="mt-2" onClick={() => cancel(r.id)}><X /> {t("إلغاء الطلب")}</Button>
                )}
              </div>
            ))}
          </section>
        </>}
      </main>
    </div>
  );
}
