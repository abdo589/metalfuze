import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Inbox, Loader2, LogOut, Mail, PenSquare, RefreshCw, Reply, Search, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  completeOutlookConnect, disconnectOutlook, getOutlookMessage, listOutlookMail, sendOutlookMail, startOutlookConnect,
  type MailFull, type MailItem,
} from "@/lib/outlook.functions";

export const Route = createFileRoute("/mail")({
  head: () => ({
    meta: [
      { title: "البريد — Outlook — Metal Fuze" },
      { name: "description", content: "اربط بريد Outlook الخاص بك واقرأ رسائلك وأرسلها من داخل نظام Metal Fuze." },
      { property: "og:title", content: "البريد — Outlook — Metal Fuze" },
      { property: "og:description", content: "بريد Outlook الشخصي داخل النظام." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MailPage,
});

const FOLDERS = [["inbox", "الوارد"], ["sentitems", "المرسل"], ["drafts", "المسودات"], ["junkemail", "غير المرغوب"], ["deleteditems", "المحذوف"]] as const;
type Folder = (typeof FOLDERS)[number][0];

function waitForCode(popup: Window) {
  return new Promise<string | null>((resolve, reject) => {
    const cleanup = () => { window.removeEventListener("message", onMsg); clearInterval(poll); };
    const onMsg = (e: MessageEvent) => {
      const type = e.data?.type;
      if (e.origin !== window.location.origin || e.source !== popup || e.data?.connectorId !== "microsoft_outlook"
        || (type !== "appUserConnectorOAuthComplete" && type !== "appUserConnectorOAuthFailed")) return;
      cleanup();
      if (type === "appUserConnectorOAuthComplete") resolve(typeof e.data.code === "string" ? e.data.code : null);
      else { popup.close(); reject(new Error("فشل ربط Outlook")); }
    };
    window.addEventListener("message", onMsg);
    const poll = window.setInterval(() => { if (popup.closed) { cleanup(); reject(new Error("أُغلقت النافذة قبل إكمال الربط")); } }, 500);
  });
}

function MailPage() {
  const list = useServerFn(listOutlookMail);
  const getMsg = useServerFn(getOutlookMessage);
  const send = useServerFn(sendOutlookMail);
  const start = useServerFn(startOutlookConnect);
  const complete = useServerFn(completeOutlookConnect);
  const disconnect = useServerFn(disconnectOutlook);

  const [state, setState] = useState<"loading" | "disconnected" | "reconnect" | "ok">("loading");
  const [me, setMe] = useState<{ name: string; email: string } | null>(null);
  const [folder, setFolder] = useState<Folder>("inbox");
  const [items, setItems] = useState<MailItem[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<MailFull | null>(null);
  const [loadingMsg, setLoadingMsg] = useState<string | null>(null);
  const [compose, setCompose] = useState<{ to: string; subject: string; body: string; replyTo?: string } | null>(null);

  const load = useCallback(async (f: Folder, query?: string) => {
    setBusy(true);
    try {
      const r = await list({ data: { folder: f, q: query || undefined } });
      setState(r.state); setMe(r.me); setItems(r.items);
    } catch (e) { toast.error((e as Error).message); setState((s) => (s === "loading" ? "disconnected" : s)); }
    finally { setBusy(false); }
  }, [list]);
  useEffect(() => { load(folder); }, [folder, load]);

  async function connect() {
    const popup = window.open("", "outlook-oauth", "width=600,height=720");
    if (!popup) { toast.error("اسمح بالنوافذ المنبثقة ثم حاول مرة أخرى"); return; }
    try {
      const { authorizationUrl } = await start();
      const done = waitForCode(popup);
      popup.location.href = authorizationUrl;
      const code = await done;
      if (code) await complete({ data: { code } });
      toast.success(state === "reconnect" ? "تمت إعادة ربط Outlook" : "تم ربط Outlook بحسابك");
      load(folder);
    } catch (e) { popup.close(); toast.error((e as Error).message); }
  }

  async function view(m: MailItem) {
    setLoadingMsg(m.id);
    try {
      const full = await getMsg({ data: { id: m.id } });
      setOpen(full);
      setItems((l) => l.map((x) => (x.id === m.id ? { ...x, read: true } : x)));
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoadingMsg(null); }
  }

  async function doSend() {
    if (!compose) return;
    setBusy(true);
    try {
      await send({ data: compose });
      toast.success("تم الإرسال"); setCompose(null);
      if (folder === "sentitems") load(folder);
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  if (state === "loading") return <div className="grid min-h-[60vh] place-items-center text-muted-foreground"><Loader2 className="animate-spin" /></div>;

  if (state !== "ok") {
    return (
      <div className="mx-auto grid min-h-[70vh] max-w-md place-items-center px-4 text-center">
        <div className="space-y-4 rounded-2xl border border-border bg-card p-8">
          <div className="mx-auto grid size-16 place-items-center rounded-full bg-primary/10"><Mail className="size-8 text-primary" /></div>
          <h1 className="font-display text-2xl font-extrabold">{state === "reconnect" ? "أعد ربط Outlook" : "اربط بريد Outlook"}</h1>
          <p className="text-sm text-muted-foreground">
            {state === "reconnect" ? "صلاحية الوصول لبريدك تحتاج تجديد." : "اربط بريدك الشخصي على Outlook لتقرأ رسائلك وترسلها من داخل النظام. بريدك يظهر لك أنت فقط."}
          </p>
          <Button className="w-full" onClick={connect}><Mail /> {state === "reconnect" ? "إعادة الربط" : "ربط Outlook"}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold">البريد</h1>
          <p className="text-sm text-muted-foreground" dir="ltr">{me?.email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setCompose({ to: "", subject: "", body: "" })}><PenSquare /> رسالة جديدة</Button>
          <Button variant="outline" size="icon" aria-label="تحديث" onClick={() => load(folder, q)} disabled={busy}><RefreshCw className={busy ? "animate-spin" : ""} /></Button>
          <Button variant="outline" onClick={async () => { if (!confirm("فصل بريد Outlook عن حسابك؟")) return; await disconnect(); setState("disconnected"); setItems([]); }}><LogOut /> فصل</Button>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-[200px_1fr]">
        <nav className="flex gap-2 overflow-x-auto md:flex-col">
          {FOLDERS.map(([k, l]) => (
            <button key={k} onClick={() => { setFolder(k); setQ(""); }}
              className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition ${folder === k ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
              <Inbox className="size-4" /> {l}
            </button>
          ))}
        </nav>
        <section className="rounded-xl border border-border bg-card">
          <form className="relative border-b border-border p-3" onSubmit={(e) => { e.preventDefault(); load(folder, q); }}>
            <Search className="absolute right-6 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث في البريد…" className="pr-9" />
          </form>
          <ul>
            {items.map((m) => (
              <li key={m.id}>
                <button onClick={() => view(m)} className={`flex w-full items-start gap-3 border-b border-border/60 p-3 text-start hover:bg-muted/40 ${m.read ? "" : "bg-primary/5"}`}>
                  <span className={`mt-2 size-2 shrink-0 rounded-full ${m.read ? "bg-transparent" : "bg-primary"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`truncate ${m.read ? "" : "font-bold"}`}>{m.from || "—"}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{m.date ? new Date(m.date).toLocaleString("ar-SA-u-nu-latn", { dateStyle: "short", timeStyle: "short" }) : ""}</span>
                    </div>
                    <div className={`truncate text-sm ${m.read ? "" : "font-semibold"}`}>{m.subject}</div>
                    <div className="truncate text-xs text-muted-foreground">{m.preview}</div>
                  </div>
                  {loadingMsg === m.id && <Loader2 className="size-4 animate-spin" />}
                </button>
              </li>
            ))}
            {!items.length && <li className="p-10 text-center text-muted-foreground">{busy ? "جارٍ التحميل…" : "لا توجد رسائل"}</li>}
          </ul>
        </section>
      </div>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          {open && (
            <>
              <DialogHeader><DialogTitle>{open.subject}</DialogTitle></DialogHeader>
              <div className="space-y-1 text-sm">
                <div><span className="text-muted-foreground">من: </span>{open.from} <span dir="ltr" className="text-muted-foreground">&lt;{open.fromAddr}&gt;</span></div>
                <div><span className="text-muted-foreground">إلى: </span><span dir="ltr">{open.to}</span></div>
              </div>
              <iframe title="محتوى الرسالة" sandbox="" srcDoc={open.html} className="h-[55vh] w-full rounded-lg border border-border bg-background" />
              <Button variant="outline" onClick={() => { setCompose({ to: open.fromAddr, subject: `RE: ${open.subject}`, body: "", replyTo: open.id }); setOpen(null); }}><Reply /> رد</Button>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!compose} onOpenChange={(o) => !o && setCompose(null)}>
        <DialogContent className="max-w-xl">
          {compose && (
            <>
              <DialogHeader><DialogTitle>{compose.replyTo ? "رد" : "رسالة جديدة"}</DialogTitle></DialogHeader>
              <Input dir="ltr" placeholder="إلى (name@example.com)" value={compose.to} disabled={!!compose.replyTo} onChange={(e) => setCompose({ ...compose, to: e.target.value })} />
              <Input placeholder="الموضوع" value={compose.subject} disabled={!!compose.replyTo} onChange={(e) => setCompose({ ...compose, subject: e.target.value })} />
              <Textarea rows={10} placeholder="نص الرسالة" value={compose.body} onChange={(e) => setCompose({ ...compose, body: e.target.value })} />
              <Button onClick={doSend} disabled={busy || !compose.body.trim()}><Send /> إرسال</Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
