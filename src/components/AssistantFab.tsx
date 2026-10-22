import { t, useLanguage } from "@/lib/i18n";
import { useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { BrainCircuit, MessageSquarePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AssistantChat } from "@/components/AssistantChat";
import { threadStore } from "@/lib/threads";
import { assistantAllowed, useRole } from "@/lib/permissions";

/**
 * Floating advisor button: opens the smart advisor as a side panel from any page
 * the account is already allowed to use.
 */
export function AssistantFab() {
  useLanguage();
  const role = useRole();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);

  if (!assistantAllowed(role)) return null;
  // The advisor page itself already shows the full chat.
  if (pathname.startsWith("/assistant")) return null;

  const openPanel = () => {
    const id = threadStore.all()[0]?.id ?? threadStore.create();
    threadStore.ensure(id);
    setThreadId(id);
    setOpen(true);
  };

  return (
    <>
      {open && (
        <div className="fixed inset-x-2 bottom-2 z-50 flex h-[70dvh] flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl print:hidden sm:inset-x-auto sm:bottom-24 sm:end-6 sm:h-[min(660px,78dvh)] sm:w-[430px]">
          <header className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground"><BrainCircuit className="size-4" /></span>
              <b className="truncate text-sm">{t("المستشار الذكي")}</b>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button size="icon" variant="ghost" className="size-8" aria-label={t("محادثة جديدة")} title={t("محادثة جديدة")}
                onClick={() => setThreadId(threadStore.create())}>
                <MessageSquarePlus className="size-4" />
              </Button>
              <Button size="icon" variant="ghost" className="size-8" aria-label={t("إغلاق")} title={t("إغلاق")} onClick={() => setOpen(false)}>
                <X className="size-4" />
              </Button>
            </div>
          </header>
          <div className="flex min-h-0 flex-1 flex-col p-2">
            {threadId && <AssistantChat key={threadId} threadId={threadId} />}
          </div>
        </div>
      )}
      {!open && (
        <Button onClick={openPanel} size="icon" className="fixed bottom-5 end-5 z-40 size-12 rounded-full shadow-lg print:hidden"
          aria-label={t("المستشار الذكي")} title={t("المستشار الذكي")}>
          <BrainCircuit />
        </Button>
      )}
    </>
  );
}
