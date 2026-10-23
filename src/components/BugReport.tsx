import { t, useLanguage } from "@/lib/i18n";
import { useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bug } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/lib/permissions";

async function me() {
  const { data } = await supabase.auth.getUser();
  const u = data.user;
  return u ? { id: u.id, name: (u.user_metadata?.["display_name"] as string) || (u.email ?? "").split("@")[0] || "" } : null;
}

const sent = new Set<string>();
/** Errors on screen are filed automatically for the developer: deduped, max 5 per visit. */
async function fileAuto(message: string) {
  const key = message.slice(0, 200);
  if (!key || sent.has(key) || sent.size >= 5) return;
  sent.add(key);
  const u = await me();
  if (!u) return;
  await supabase.from("bug_reports").insert({
    reporter_id: u.id, reporter_name: u.name, kind: "auto",
    page: window.location.pathname.slice(0, 500), description: message.slice(0, 4000),
  });
}

export function BugReportButton() {
  useLanguage();
  const role = useRole();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!role) return;
    const onErr = (e: ErrorEvent) => { void fileAuto(`${e.message}\n${e.error?.stack ?? ""}`); };
    const onRej = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      void fileAuto(r instanceof Error ? `${r.message}\n${r.stack ?? ""}` : String(r));
    };
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onRej);
    return () => { window.removeEventListener("error", onErr); window.removeEventListener("unhandledrejection", onRej); };
  }, [role]);

  if (!role || role === "developer") return null;

  const submit = async () => {
    if (!text.trim()) return;
    setBusy(true);
    const u = await me();
    const { error } = u ? await supabase.from("bug_reports").insert({
      reporter_id: u.id, reporter_name: u.name, kind: "user", page: pathname.slice(0, 500), description: text.trim().slice(0, 4000),
    }) : { error: new Error("") };
    setBusy(false);
    if (error) { toast.error(t("تعذر إرسال البلاغ")); return; }
    toast.success(t("وصل البلاغ للمبرمج، شكرًا"));
    setText(""); setOpen(false);
  };

  return (
    <>
      <Button variant="outline" size="icon" className="fixed bottom-5 start-5 z-40 rounded-full shadow-lg print:hidden"
        aria-label={t("بلّغ عن عطل")} title={t("بلّغ عن عطل")} onClick={() => setOpen(true)}>
        <Bug />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("بلّغ عن عطل")}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{t("اكتب المشكلة اللي حصلت، والصفحة الحالية بتتسجل تلقائيًا.")}</p>
          <Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} maxLength={4000}
            placeholder={t("مثال: زر الحفظ مش شغال في صفحة الرواتب")} />
          <DialogFooter>
            <Button onClick={submit} disabled={busy || !text.trim()}>{busy ? t("جارٍ الإرسال...") : t("إرسال")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
