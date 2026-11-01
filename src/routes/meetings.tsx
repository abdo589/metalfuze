import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SalesMeetingInbox } from "@/components/SalesMeetingAttendance";
import { SalesMeetings } from "@/components/SalesMeetings";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { canCreateSalesDeal } from "@/lib/sales";
import { useRole } from "@/lib/permissions";
import { t, useLanguage } from "@/lib/i18n";

export const Route = createFileRoute("/meetings")({
  head: () => ({ meta: [
    { title: "الاجتماعات — Metal Fuze" },
    { name: "description", content: "مواعيد اجتماعات العملاء وردود هشام وهيثم على الحضور." },
    { property: "og:title", content: "الاجتماعات — Metal Fuze" },
    { property: "og:description", content: "جدولة اجتماعات العملاء ومتابعة الموافقة والرفض على الحضور." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: MeetingsPage,
});

function MeetingsPage() {
  useLanguage();
  const role = useRole();
  const [creating, setCreating] = useState(false);
  const [version, setVersion] = useState(0);
  const [me, setMe] = useState<{ id: string; email: string; emailConfirmed: boolean } | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setMe({ id: data.user.id, email: data.user.email ?? "", emailConfirmed: !!data.user.email_confirmed_at });
    });
  }, []);
  return <main className="space-y-6 p-4 md:p-8">
    <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="font-display text-2xl font-bold">{t("الاجتماعات")}</h1>
      {canCreateSalesDeal(role, me) && <Button onClick={() => setCreating(true)}><Plus className="size-4" />{t("إنشاء اجتماع")}</Button>}
    </div>
    <SalesMeetingInbox key={version} standaloneOnly />
    <SalesMeetings deal={null} standalone={creating} onClose={() => { setCreating(false); setVersion((v) => v + 1); }} />
  </main>;
}