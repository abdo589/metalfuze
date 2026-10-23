import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { SelfieCheckin } from "@/components/SelfieCheckin";
import { t, useLanguage, locale } from "@/lib/i18n";
import { useCanEditHr } from "@/lib/permissions";
import { usePayroll } from "@/lib/payroll";
import { supervisorCheckin, emailCheckinLink } from "@/lib/checkin.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";
import { checkinError } from "@/lib/checkin-client";
import { useSites } from "@/components/RemoteAttendance";

export const Route = createFileRoute("/workers-checkin")({
  head: () => ({
    meta: [
      { title: "تسجيل حضور العمال — Metal Fuze" },
      { name: "description", content: "يسجل المشرف حضور وانصراف العمال من موقع المشروع بصورة وموقع." },
      { property: "og:title", content: "تسجيل حضور العمال — Metal Fuze" },
      { property: "og:description", content: "حضور العمال من الموقع بالجوال." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WorkersCheckin,
});

function WorkersCheckin() {
  useLanguage();
  const canEdit = useCanEditHr();
  const employees = usePayroll().filter((e) => e.active);
  const { sites } = useSites();
  const submit = useServerFn(supervisorCheckin);
  const sendLink = useServerFn(emailCheckinLink);
  const [id, setId] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const emp = employees.find((e) => e.id === id);
  const site = sites.find((s) => s.id === emp?.siteId);

  return (
    <div className="mx-auto max-w-md space-y-5 p-4 md:p-8">
      <header className="text-center">
        <h1 className="font-display text-2xl font-bold">{t("تسجيل حضور العمال")}</h1>
        <p className="text-sm text-muted-foreground">{t("اختر العامل، ثم التقط صورته من موقع العمل")}</p>
      </header>
      {!canEdit ? <p className="rounded-xl bg-muted p-4 text-center text-sm">{checkinError("forbidden")}</p> : (
        <>
          <select value={id} onChange={(e) => { setId(e.target.value); setEmail(employees.find((x) => x.id === e.target.value)?.email ?? ""); }} className="h-12 w-full rounded-md border border-input bg-background px-3">
            <option value="">{t("اختر العامل…")}</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.name} — {e.role}</option>)}
          </select>
          {emp && <p className="text-center text-sm text-muted-foreground">{t("موقع العمل")}: <b>{site?.name ?? t("أي مكان")}</b></p>}
          {emp && (
            <div className="space-y-2 rounded-xl border border-border p-3">
              <label className="text-sm font-medium">{t("إيميل العامل")}</label>
              <div className="flex gap-2">
                <Input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
                <Button disabled={sending || !email.includes("@")} onClick={async () => {
                  setSending(true);
                  try {
                    const r = await sendLink({ data: { employeeId: id, email } });
                    if (r.ok) toast.success(t("تم إرسال رابط التسجيل على الإيميل"));
                    else toast.error(r.error === "domain" ? t("الإيميلات لم تُفعّل بعد — بانتظار تأكيد الدومين") : r.error === "forbidden" ? checkinError("forbidden") : t("تعذر إرسال الإيميل"));
                  } catch { toast.error(t("تعذر إرسال الإيميل")); } finally { setSending(false); }
                }}><Mail className="h-4 w-4" /> {t("إرسال")}</Button>
              </div>
              <p className="text-xs text-muted-foreground">{t("يوصله رابط يسجّل منه حضوره وانصرافه بالسيلفي من جواله")}</p>
            </div>
          )}
          <SelfieCheckin disabled={!emp} onSubmit={async (d) => {
            const r = await submit({ data: { employeeId: id, ...d } });
            if (!r.ok) throw new Error(checkinError(r.error));
            toast.success(`${emp!.name}: ${d.action === "in" ? t("تم تسجيل الحضور") : t("تم تسجيل الانصراف")} ${new Date(r.time).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" })}`);
            setId("");
          }} />
        </>
      )}
    </div>
  );
}
