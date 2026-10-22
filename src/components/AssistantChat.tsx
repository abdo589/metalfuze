import { t, useLanguage, locale } from "@/lib/i18n";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type FileUIPart, type UIMessage } from "ai";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useRef, useState } from "react";
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

/** What the advisor can read: PDF, pictures, and plain-text files. */
const ACCEPT = ".pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.csv,.md,.json,application/pdf,image/*,text/*";
const MAX_FILES = 5;
const MAX_FILE_BYTES = 8 * 1024 * 1024;

const nameOf = (f: File) => f.name || t("ملف");
const isPdf = (f: File) => f.type === "application/pdf" || nameOf(f).toLowerCase().endsWith(".pdf");
const isImage = (f: File) => f.type.startsWith("image/") || /\.(png|jpe?g|gif|webp)$/i.test(nameOf(f));
const isTextish = (f: File) => f.type.startsWith("text/") || f.type === "application/json" || /\.(txt|csv|md|json|xml|log|tsv)$/i.test(nameOf(f));
const isReadable = (f: File) => isPdf(f) || isImage(f) || isTextish(f);

/** Files are read with FileReader — the site's content policy blocks fetching blob: or data: links. */
function readAsDataUrl(file: File) {
  // eslint-disable-next-line no-await-in-loop
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

function dataUrlToText(dataUrl: string) {
  const bin = atob(dataUrl.slice(dataUrl.indexOf(",") + 1));
  return new TextDecoder("utf-8").decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
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

  const [picks, setPicks] = useState<{ id: string; name: string; dataUrl: string; file: File }[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [reading, setReading] = useState(false);

  // Once an answer lands, drop the file bytes from the conversation so saved threads stay small.
  useEffect(() => {
    if (status !== "ready" && status !== "error") return;
    const hasFileBytes = messages.some((m) => m.parts.some((p) => p.type === "file" && (p as FileUIPart).url?.startsWith("data:")));
    if (hasFileBytes) { setMessages(withoutFileBytes(messages)); return; }
    threadStore.setMessages(threadId, messages);
  }, [status, messages, setMessages, threadId]);

  const busy = status === "submitted" || status === "streaming";

  const onPick = async (list: FileList | null) => {
    if (!list?.length) return;
    const incoming = [...list];
    if (incoming.some((f) => !isReadable(f))) {
      toast.error(t("المستشار يقرأ PDF والصور وملفات النص — حوّل Word أو Excel إلى PDF أولاٌ"));
    }
    const usable = incoming.filter(isReadable);
    const oversize = usable.filter((f) => f.size > MAX_FILE_BYTES);
    if (oversize.length) toast.error(t("حجم الملف أكبر من 8 ميجابايت"));
    const room = MAX_FILES - picks.length;
    if (usable.filter((f) => f.size <= MAX_FILE_BYTES).length > room) toast.error(t(`الحد الأقصى ${MAX_FILES} ملفات`));
    const chosen = usable.filter((f) => f.size <= MAX_FILE_BYTES).slice(0, Math.max(0, room));
    if (!chosen.length) return;
    setReading(true);
    try {
      const read = await Promise.all(chosen.map(async (file) => ({
        id: crypto.randomUUID(), name: nameOf(file), file, dataUrl: await readAsDataUrl(file),
      })));
      setPicks((prev) => [...prev, ...read]);
    } catch {
      toast.error(t("تعذر قراءة الملف، جرّب مرة أخرى"));
    } finally {
      setReading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const send = async (text: string) => {
    if (busy || reading) return;
    let body = text.trim();
    const inline: FileUIPart[] = [];
    for (const p of picks) {
      if (isTextish(p.file)) {
        try { body += `\n\n[${t("ملف مرفق")}: ${p.name}]\n${dataUrlToText(p.dataUrl).slice(0, 60000)}`; }
        catch { body += `\n\n[${t("ملف مرفق")}: ${p.name}]`; }
      } else {
        inline.push({ type: "file", url: p.dataUrl, mediaType: p.file.type || "application/pdf", filename: p.name });
      }
    }
    if (!body && !inline.length) return;
    setPicks([]);
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
                  <Button key={s} variant="outline" className="h-auto whitespace-normal py-2 text-start" onClick={() => send(t(s))}>{t(s)}</Button>
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
        {picks.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {picks.map((p) => (
              <span key={p.id} className="inline-flex max-w-full items-center gap-1 rounded-full border bg-background px-2 py-1 text-xs">
                <Paperclip className="size-3 shrink-0" />
                <span className="truncate">{p.name}</span>
                <Button type="button" variant="ghost" size="icon" className="size-5 text-muted-foreground hover:text-destructive"
                  aria-label={`${t("إزالة")} ${p.name}`} onClick={() => setPicks((prev) => prev.filter((x) => x.id !== p.id))}>
                  <X className="size-3" />
                </Button>
              </span>
            ))}
          </div>
        )}
        <PromptInput onSubmit={(msg) => send(msg.text ?? "")}>
          <input ref={fileRef} type="file" accept={ACCEPT} multiple className="hidden"
            aria-label={t("إرفاق ملف")} onChange={(e) => onPick(e.target.files)} />
          <PromptInputTextarea autoFocus placeholder={t("مثال: ما المشاريع المتأخرة وما الحل؟")} />
          <PromptInputFooter>
            <PromptInputTools>
              <Button type="button" variant="ghost" size="icon" aria-label={t("إرفاق ملف")} title={t("إرفاق ملف")}
                disabled={reading} onClick={() => fileRef.current?.click()}>
                <Paperclip />
              </Button>
            </PromptInputTools>
            <PromptInputSubmit status={status} onStop={stop} />
          </PromptInputFooter>
        </PromptInput>
        <p className="mt-1 px-1 text-[11px] text-muted-foreground">{t("تقدر ترفق ملف PDF أو صورة أو ملف نصي ويقرأه المستشار")}</p>
      </div>
    </div>
  );
}
