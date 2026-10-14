import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { threadStore } from "@/lib/threads";

export const Route = createFileRoute("/assistant/")({
  head: () => ({
    meta: [
      { title: "المستشار الذكي — Metal Fuze" },
      { name: "description", content: "اسأل عن مشاريع Metal Fuze واحصل على تحليل وتوصيات عملية." },
      { property: "og:title", content: "المستشار الذكي — Metal Fuze" },
      { property: "og:description", content: "تحليل ذكي لبيانات المشاريع وتوصيات للإدارة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AssistantIndex,
});

function AssistantIndex() {
  const navigate = useNavigate();
  useEffect(() => {
    const id = threadStore.all()[0]?.id ?? threadStore.create();
    navigate({ to: "/assistant/$threadId", params: { threadId: id }, replace: true });
  }, [navigate]);
  return null;
}
