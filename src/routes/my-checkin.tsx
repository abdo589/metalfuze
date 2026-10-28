import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getMyCheckinToken } from "@/lib/checkin.functions";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/my-checkin")({
  head: () => ({ meta: [
    { title: "تسجيل حضوري | METAL FUZE" },
    { name: "description", content: "تسجيل الحضور والانصراف لحسابك فقط" },
    { property: "og:title", content: "تسجيل حضوري | METAL FUZE" },
    { property: "og:description", content: "تسجيل الحضور والانصراف لحسابك فقط" },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: MyCheckin,
});

function MyCheckin() {
  const t = useT();
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    getMyCheckinToken().then((r) => {
      if (r.ok) navigate({ to: "/checkin/$token", params: { token: r.token }, replace: true });
      else setFailed(true);
    }, () => setFailed(true));
  }, [navigate]);
  return (
    <div className="p-8 text-center text-muted-foreground">
      {failed ? t("حسابك غير مربوط بموظف — اطلب من الموارد البشرية ربطه") : t("جاري التحميل…")}
    </div>
  );
}
