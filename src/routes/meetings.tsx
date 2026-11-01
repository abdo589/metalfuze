import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { SalesMeetingInbox } from "@/components/SalesMeetingAttendance";
import { SalesMeetings } from "@/components/SalesMeetings";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { canEditSalesDeal } from "@/lib/sales";
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
  const [deals, setDeals] = useState<Tables<"sales_deals">[]>([]);
  const [selected, setSelected] = useState<Tables<"sales_deals"> | null>(null);
  const [version, setVersion] = useState(0);
  const [me, setMe] = useState<{ id: string; email: string; emailConfirmed: boolean } | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setMe({ id: data.user.id, email: data.user.email ?? "", emailConfirmed: !!data.user.email_confirmed_at });
    });
    supabase.from("sales_deals").select("*").order("created_at", { ascending: false }).then(({ data }) => setDeals(data ?? []));
  }, []);
  const editable = deals.filter((d) => canEditSalesDeal(role, me, d.owner_id));
  return <main className="space-y-6 p-4 md:p-8">
    <h1 className="font-display text-2xl font-bold">{t("الاجتماعات")}</h1>
    {editable.length > 0 && <Select value="" onValueChange={(id) => setSelected(deals.find((d) => d.id === id) ?? null)}>
      <SelectTrigger className="w-full sm:w-80" aria-label={t("جدولة اجتماع")}><SelectValue placeholder={t("جدولة اجتماع")} /></SelectTrigger>
      <SelectContent>{editable.map((d) => <SelectItem key={d.id} value={d.id}>{d.client} — {d.project}</SelectItem>)}</SelectContent>
    </Select>}
    <SalesMeetingInbox key={version} />
    <SalesMeetings deal={selected} onClose={() => { setSelected(null); setVersion((v) => v + 1); }} />
  </main>;
}