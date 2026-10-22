import { t, useLanguage, locale } from "@/lib/i18n";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type FileUIPart, type UIMessage } from "ai";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState } from "react";
import { BrainCircuit, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { daysLeft, projectStore } from "@/lib/projects";
import { threadStore } from "@/lib/threads";

const SUGGESTIONS = [
  "ما المشاريع الأكثر خطورة الآن ولماذا؟",
  "من قرب انتهاء إقاماته أو وثائقه؟",
  "من حضر اليوم ومن تأخر؟",
  "كم صافي رواتب هذا الشهر؟",
  "أين توجد فجوات في التحصيل المالي؟",
  "ما أولويات الإدارة لهذا الأسبوع؟",
];

/** Attachments the advisor can read: PDF, pictures, and plain text files. */
const ACCEPT = ".pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.csv,.md,.json,application/pdf,image/*,text/*";
const MAX_FILES = 5;
const MAX_FILE_BYTES = 8 * 1024 * 1024;

const filenameOf = (f: FileUIPart) => f.filename || t("ملف");
const isPdf = (f: FileUIPart) => (f.mediaType || "").toLowerCase() === "application/pdf" || filenameOf(f).toLowerCase().endsWith(".pdf");
const isImage = (f: FileUIPart) => (f.mediaType || "").toLowerCase().startsWith("image/");
const isTextish = (f: FileUIPart) => {
  const mt = (f.mediaType || "").toLowerCase();
  const name = filenameOf(f).toLowerCase();
  return mt.startsWith("text/") || mt === "application/json" || mt === "application/csv" || /\.(txt|csv|md|json|xml|log|tsv)$/.test(name);
};
const isReadable = (f: FileUIPart) => isPdf(f) || isImage(f) || isTextish(f);

async function readAsText(url: string) {
  const res = await fetch(url);
  return await res.text();
}

/** Saved threads keep only the file name — the file bytes stay in memory for the live conversation. */
function withoutFileBytes(messages: UIMessage[]): UIMessage[] {
  return messages.map((m) => ({
    ...m,
    parts: m.parts.flatMap((p) =>
      p.type === "file" ? [{ type: "text" as const, text: `[${t("مرفق")}: ${p.filename || ""}]` }] : [p],
    ),
  }));
}

function AttachButton() {
  const attachments = usePromptInputAttachments();
  return (
    <Button type="button" variant="ghost" size="icon" aria-label={t("إرفاق ملف")} title={t("إرفاق ملف")}
      onClick={attachments.openFileDialog}>
      <Paperclip />
    </Button>
  );
}

function AttachChips() {
  const attachments = usePromptInputAttachments();
  if (!attachments.files.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 px-3 pt-3">
      {attachments.files.map((f) => (
        <span key={f.id} className="inline-flex max-w-full items-center gap-1 rounded-full border bg-background px-2 py-1 text-xs">
          <Paperclip className="size-3 shrink-0" />
          <span className="truncate">{f.filename}</span>
          <Button type="button" variant="ghost" size="icon" className="size-5 text-muted-foreground hover:text-destructive"
            aria-label={`${t("إزالة")} ${f.filename}`} onClick={() => attachments.remove(f.id)}>
            <X className="size-3" />
          </Button>
        </span>
      ))}
    </div>
  );
}

export function AssistantChat({ threadId }: { threadId: string }) {
  useLanguage();
  const initial = useMemo(() => threadStore.get(threadId)?.messages ?? [], [threadId]);
  const transport = useMemo(() => new DefaultChatTransport({
    api: "/api/chat",
    headers: async (): Promise<Record<string, string>> => {
      const { data } = await supabase.auth.getSession();
      return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
    },
    body: () => ({
      threadId,
      language: locale() === "en-GB" ? "en" : "ar",
      today: new Date().toISOString().slice(0, 10),
      projects: projectStore.all().map(({ id: _id, ...p }) => ({ ...p, daysLeft: daysLeft(p.end) })),
    }),
  }), [threadId]);
  const { messages, sendMessage, setMessages, status, stop } = useChat({
    id: threadId,
    messages: initial,
    transport,
    onError: (e) => {
      const m = e.message || "";
      if (m.includes("429")) toast.error(t("طلبات كثيرة، حاول بعد قليل"));
      else if (m.includes("402")) toast.error(t("نفد رصيد الذكاء الاصطناعي، أضف رصيداٌ من إعدادات مساحة العمل"));
      else toast.error(m.length < 200 && m ? m : t("تعذر الحصول على إجابة، تحقق من الاتصال"));
    },
  });

  // Once an answer lands, drop the file bytes from the conversation so saved threads stay small.
  useEffect(() => {
    if (status !== "ready" && status !== "error") return;
    const hasFileBytes = messages.some((m) => m.parts.some((p) => p.type === "file" && (p as FileUIPart).url?.startsWith("data:")));
    if (hasFileBytes) { setMessages(withoutFileBytes(messages)); return; }
    threadStore.setMessages(threadId, messages);
  }, [status, messages, setMessages, threadId]);

  const busy = status === "submitted" || status === "streaming";

  const send = async (text: string, files: FileUIPart[]) => {
    if (busy) return;
    const readable = files.filter(isReadable);
    if (readable.length !== files.length) {
      toast.error(t("المستشار يقرأ PDF والصور وملفات النص — حوّل Word أو Excel إلى PDF أولاً"));
    }
    let body = text.trim();
    for (const f of readable.filter(isTextish)) {
      try { body += `\n\n[${t("ملف مرفق")}: ${filenameOf(f)}]\n${(await readAsText(f.url ?? "")).slice(0, 60000)}`; }
      catch { body += `\n\n[${t("ملف مرفق")}: ${filenameOf(f)}]`; }
    }
    const inline = readable.filter((f) => !isTextish(f));
    if (!body && !inline.length) return;
    sendMessage({ text: body, files: inline });
  };

  return (
    <div className="surface flex min-h-0 flex-1 flex-col rounded-2xl">
      <Conversation className="min-h-0 flex-1">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState icon={<BrainCircuit className="size-10" />} title={t("اسأل أي حاجة في النظام")}
              description={t("أجيبك من بيانات النظام الحالية، وتقدر ترفق ملف يقرأه")}>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <Button key={s} variant="outline" className="h-auto whitespace-normal py-2 text-start" onClick={() => send(t(s), [])}>{t(s)}</Button>
                ))}
              </div>
            </ConversationEmptyState>
          ) : messages.map((m) => (
            <Message key={m.id} from={m.role}>
              <MessageContent className={m.role === "user" ? "group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground" : ""}>
                {m.parts.map((p, i) => p.type === "text"
                  ? <MessageResponse key={i}>{p.text}</MessageResponse>
                  : p.type === "file"
                    ? <span key={i} className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-1 text-xs text-foreground">
                      <Paperclip className="size-3" /> {p.filename || t("ملف")}
                    </span>
                    : null)}
              </MessageContent>
            </Message>
          ))}
          {status === "submitted" && <Shimmer className="text-sm">{t("جارٍ تحليل بيانات النظام...")}</Shimmer>}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="p-3">
        <PromptInput accept={ACCEPT} multiple maxFiles={MAX_FILES} maxFileSize={MAX_FILE_BYTES}
          onError={(err) => toast.error(err.code === "max_files"
            ? t(`الحد الأقصى ${MAX_FILES} ملفات`)
            : err.code === "max_file_size" ? t("حجم الملف أكبر من 8 ميجابايت") : err.message)}
          onSubmit={(msg) => send(msg.text ?? "", msg.files)}>
          <AttachChips />
          <PromptInputTextarea autoFocus placeholder={t("مثال: ما المشاريع المتأخرة وما الحل؟")} />
          <PromptInputFooter>
            <PromptInputTools><AttachButton /></PromptInputTools>
            <PromptInputSubmit status={status} onStop={stop} />
          </PromptInputFooter>
        </PromptInput>
        <p className="mt-1 px-1 text-[11px] text-muted-foreground">{t("تقدر ترفق ملف PDF أو صورة أو ملف نصي ويقرأه المستشار")}</p>
      </div>
    </div>
  );
}
