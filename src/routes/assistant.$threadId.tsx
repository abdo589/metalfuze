import { t, useLanguage } from "@/lib/i18n";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, BrainCircuit, MessageSquarePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AssistantChat } from "@/components/AssistantChat";
import { threadStore, useThreads } from "@/lib/threads";

export const Route = createFileRoute("/assistant/$threadId")({
  head: () => ({
    meta: [
      { title: "محادثة المستشار الذكي — Metal Fuze" },
      { name: "description", content: "اسأل أي حاجة في نظام Metal Fuze — المشاريع والموظفون والإجازات والحضور والرواتب." },
      { property: "og:title", content: "محادثة المستشار الذكي — Metal Fuze" },
      { property: "og:description", content: "أسئلة النظام وإجابات فورية من بياناته الحية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AssistantPage,
});

function AssistantPage() {
  useLanguage();
  const { threadId } = Route.useParams();
  const threads = useThreads();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  useEffect(() => { threadStore.ensure(threadId); setReady(true); }, [threadId]);

  return (
    <div className="mx-auto flex h-dvh max-w-7xl gap-4 px-4 py-4 sm:px-6">
      <aside className="surface hidden w-64 shrink-0 flex-col gap-2 rounded-2xl p-3 md:flex">
        <Button onClick={() => navigate({ to: "/assistant/$threadId", params: { threadId: threadStore.create() } })}>
          <MessageSquarePlus /> {t("محادثة جديدة")}</Button>
        <div className="flex-1 space-y-1 overflow-y-auto">
          {threads.map((thread) => (
            <div key={thread.id} className={`group flex items-center gap-1 rounded-lg ${thread.id === threadId ? "bg-accent" : "hover:bg-accent/60"}`}>
              <Link to="/assistant/$threadId" params={{ threadId: thread.id }} className="flex-1 truncate px-3 py-2 text-sm">
                {thread.title === "محادثة جديدة" ? t(thread.title) : thread.title}
              </Link>
              <Button variant="ghost" size="icon" aria-label={t("حذف المحادثة")} className="text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
                onClick={() => {
                  threadStore.remove(thread.id);
                  if (thread.id === threadId) navigate({ to: "/assistant" });
                }}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground"><BrainCircuit /></span>
            <div>
              <h1 className="font-display text-xl font-extrabold">{t("المستشار الذكي")}</h1>
              <p className="text-xs text-muted-foreground">{t("يجيب على أي سؤال في النظام من بياناته الحية")}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="md:hidden" onClick={() => navigate({ to: "/assistant/$threadId", params: { threadId: threadStore.create() } })}>
              <MessageSquarePlus />
            </Button>
            <ThemeToggle />
            <Button variant="outline" asChild><Link to="/"><ArrowRight /> {t("اللوحة")}</Link></Button>
          </div>
        </header>
        {ready && <AssistantChat key={threadId} threadId={threadId} />}
      </main>
    </div>
  );
}
