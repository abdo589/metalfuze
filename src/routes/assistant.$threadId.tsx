import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BrainCircuit, MessageSquarePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea } from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { daysLeft, projectStore } from "@/lib/projects";
import { threadStore, useThreads } from "@/lib/threads";

export const Route = createFileRoute("/assistant/$threadId")({
  head: () => ({
    meta: [
      { title: "محادثة المستشار الذكي — Metal Fuze" },
      { name: "description", content: "محادثة تحليل المشاريع مع المستشار الذكي لـ Metal Fuze." },
      { property: "og:title", content: "محادثة المستشار الذكي — Metal Fuze" },
      { property: "og:description", content: "أسئلة الإدارة وإجابات مدعومة ببيانات اللوحة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AssistantPage,
});

const SUGGESTIONS = [
  "ما المشاريع الأكثر خطورة الآن ولماذا؟",
  "قارن الإنجاز الفعلي بالمخطط لكل مشروع",
  "أين توجد فجوات في التحصيل المالي؟",
  "ما أولويات الإدارة لهذا الأسبوع؟",
];

function AssistantPage() {
  const { threadId } = Route.useParams();
  const threads = useThreads();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  useEffect(() => { threadStore.ensure(threadId); setReady(true); }, [threadId]);

  return (
    <div className="mx-auto flex h-dvh max-w-7xl gap-4 px-4 py-4 sm:px-6">
      <aside className="surface hidden w-64 shrink-0 flex-col gap-2 rounded-2xl p-3 md:flex">
        <Button onClick={() => navigate({ to: "/assistant/$threadId", params: { threadId: threadStore.create() } })}>
          <MessageSquarePlus /> محادثة جديدة
        </Button>
        <div className="flex-1 space-y-1 overflow-y-auto">
          {threads.map((t) => (
            <div key={t.id} className={`group flex items-center gap-1 rounded-lg ${t.id === threadId ? "bg-accent" : "hover:bg-accent/60"}`}>
              <Link to="/assistant/$threadId" params={{ threadId: t.id }} className="flex-1 truncate px-3 py-2 text-sm">
                {t.title}
              </Link>
              <button aria-label="حذف المحادثة" className="p-2 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
                onClick={() => {
                  threadStore.remove(t.id);
                  if (t.id === threadId) navigate({ to: "/assistant" });
                }}>
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground"><BrainCircuit /></span>
            <div>
              <h1 className="font-display text-xl font-extrabold">المستشار الذكي</h1>
              <p className="text-xs text-muted-foreground">يحلل بيانات اللوحة الحالية ويقدم توصيات</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="md:hidden" onClick={() => navigate({ to: "/assistant/$threadId", params: { threadId: threadStore.create() } })}>
              <MessageSquarePlus />
            </Button>
            <ThemeToggle />
            <Button variant="outline" asChild><Link to="/"><ArrowRight /> اللوحة</Link></Button>
          </div>
        </header>
        {ready && <ChatWindow key={threadId} threadId={threadId} />}
      </main>
    </div>
  );
}

function ChatWindow({ threadId }: { threadId: string }) {
  const initial = useMemo(() => threadStore.get(threadId)?.messages ?? [], [threadId]);
  const transport = useMemo(() => new DefaultChatTransport({
    api: "/api/chat",
    body: () => ({
      threadId,
      today: new Date().toISOString().slice(0, 10),
      projects: projectStore.all().map(({ id: _id, ...p }) => ({ ...p, daysLeft: daysLeft(p.end) })),
    }),
  }), [threadId]);
  const { messages, sendMessage, status, stop } = useChat({
    id: threadId,
    messages: initial,
    transport,
    onError: (e) => {
      const m = e.message || "";
      if (m.includes("429")) toast.error("طلبات كثيرة، حاول بعد قليل");
      else if (m.includes("402")) toast.error("نفد رصيد الذكاء الاصطناعي، أضف رصيداً من إعدادات مساحة العمل");
      else toast.error(m.length < 200 && m ? m : "تعذر الحصول على إجابة، تحقق من الاتصال");
    },
  });
  useEffect(() => {
    if (status === "ready" || status === "error") threadStore.setMessages(threadId, messages);
  }, [status, messages, threadId]);

  const busy = status === "submitted" || status === "streaming";
  const send = (text: string) => { if (text.trim() && !busy) sendMessage({ text: text.trim() }); };

  return (
    <div className="surface flex min-h-0 flex-1 flex-col rounded-2xl">
      <Conversation className="min-h-0 flex-1">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState icon={<BrainCircuit className="size-10" />} title="اسأل عن مشاريعك"
              description="أجيبك من البيانات الموجودة في اللوحة حالياً">
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <Button key={s} variant="outline" className="h-auto whitespace-normal py-2 text-start" onClick={() => send(s)}>{s}</Button>
                ))}
              </div>
            </ConversationEmptyState>
          ) : messages.map((m) => (
            <Message key={m.id} from={m.role}>
              <MessageContent className={m.role === "user" ? "group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground" : ""}>
                {m.parts.map((p, i) => p.type === "text"
                  ? <MessageResponse key={i}>{p.text}</MessageResponse>
                  : null)}
              </MessageContent>
            </Message>
          ))}
          {status === "submitted" && <Shimmer className="text-sm">جارٍ تحليل بيانات المشاريع...</Shimmer>}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="p-3">
        <PromptInput onSubmit={(msg) => send(msg.text ?? "")}>
          <PromptInputTextarea autoFocus placeholder="مثال: ما المشاريع المتأخرة وما الحل؟" />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={status} onStop={stop} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
