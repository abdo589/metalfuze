import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, Search, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { t, useLanguage } from "@/lib/i18n";

export const Route = createFileRoute("/messages")({
  head: () => ({
    meta: [
      { title: "الرسائل — Metal Fuze" },
      { name: "description", content: "رسائل خاصة بين فريق Metal Fuze." },
      { property: "og:title", content: "الرسائل — Metal Fuze" },
      { property: "og:description", content: "رسائل خاصة بين فريق Metal Fuze." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MessagesPage,
});

type Profile = { id: string; display_name: string; email: string };
type Msg = { id: string; sender_id: string; recipient_id: string; body: string; read_at: string | null; created_at: string };

function MessagesPage() {
  useLanguage();
  const [me, setMe] = useState<string | null>(null);
  const [people, setPeople] = useState<Profile[]>([]);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!alive || !u.user) return;
      setMe(u.user.id);
      const [{ data: p }, { data: m }] = await Promise.all([
        supabase.from("profiles").select("id,display_name,email").order("display_name"),
        supabase.from("direct_messages").select("*").order("created_at").limit(2000),
      ]);
      if (!alive) return;
      setPeople((p ?? []).filter((x) => x.id !== u.user!.id));
      setMsgs(m ?? []);
    })();
    const ch = supabase.channel("dm")
      .on("postgres_changes", { event: "*", schema: "public", table: "direct_messages" }, (payload) => {
        const row = payload.new as Msg;
        if (!row?.id) return;
        setMsgs((prev) => prev.some((x) => x.id === row.id) ? prev.map((x) => x.id === row.id ? row : x) : [...prev, row]);
      })
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, []);

  const thread = useMemo(() => msgs.filter((m) => active && ((m.sender_id === me && m.recipient_id === active) || (m.sender_id === active && m.recipient_id === me))), [msgs, active, me]);
  const unread = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of msgs) if (m.recipient_id === me && !m.read_at) map.set(m.sender_id, (map.get(m.sender_id) ?? 0) + 1);
    return map;
  }, [msgs, me]);
  const lastAt = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of msgs) { const other = m.sender_id === me ? m.recipient_id : m.sender_id; map.set(other, m.created_at); }
    return map;
  }, [msgs, me]);
  const list = useMemo(() => people
    .filter((p) => `${p.display_name} ${p.email}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (lastAt.get(b.id) ?? "").localeCompare(lastAt.get(a.id) ?? "") || a.display_name.localeCompare(b.display_name)), [people, q, lastAt]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [thread.length, active]);
  useEffect(() => {
    if (!active || !me) return;
    const ids = thread.filter((m) => m.recipient_id === me && !m.read_at).map((m) => m.id);
    if (ids.length) supabase.from("direct_messages").update({ read_at: new Date().toISOString() }).in("id", ids).then(() => {});
  }, [thread, active, me]);

  async function send() {
    const body = draft.trim();
    if (!body || !active || !me) return;
    setSending(true);
    const { data, error } = await supabase.from("direct_messages").insert({ sender_id: me, recipient_id: active, body: body.slice(0, 4000) }).select().single();
    setSending(false);
    if (error) { toast.error(error.message); return; }
    setDraft("");
    if (data) setMsgs((prev) => prev.some((x) => x.id === data.id) ? prev : [...prev, data]);
  }

  const activePerson = people.find((p) => p.id === active);

  return (
    <div className="mx-auto flex h-[calc(100vh-6rem)] max-w-6xl flex-col gap-4 p-4">
      <h1 className="font-display text-2xl font-bold">{t("الرسائل")}</h1>
      <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-card">
        <aside className={`${active ? "hidden md:flex" : "flex"} w-full flex-col border-e border-border md:w-72`}>
          <div className="relative p-3">
            <Search className="pointer-events-none absolute start-5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("بحث عن شخص")} className="ps-8" />
          </div>
          <div className="flex-1 overflow-y-auto">
            {list.length === 0 && <p className="p-4 text-sm text-muted-foreground">{t("لا يوجد أشخاص")}</p>}
            {list.map((p) => (
              <button key={p.id} type="button" onClick={() => setActive(p.id)}
                className={`flex w-full items-center justify-between gap-2 px-4 py-3 text-start hover:bg-muted/60 ${active === p.id ? "bg-muted" : ""}`}>
                <div className="min-w-0">
                  <div className="truncate font-medium">{p.display_name || p.email}</div>
                  <div className="truncate text-xs text-muted-foreground" dir="ltr">{p.email}</div>
                </div>
                {!!unread.get(p.id) && <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">{unread.get(p.id)}</span>}
              </button>
            ))}
          </div>
        </aside>
        <section className={`${active ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col`}>
          {!activePerson ? (
            <div className="m-auto flex flex-col items-center gap-2 text-muted-foreground">
              <MessageSquare className="size-10" />
              <p>{t("اختر شخصًا لبدء المحادثة")}</p>
            </div>
          ) : (
            <>
              <header className="flex items-center gap-3 border-b border-border p-3">
                <Button size="sm" variant="ghost" className="md:hidden" onClick={() => setActive(null)}>{t("رجوع")}</Button>
                <div className="font-semibold">{activePerson.display_name || activePerson.email}</div>
              </header>
              <div className="flex-1 space-y-2 overflow-y-auto p-4">
                {thread.length === 0 && <p className="text-center text-sm text-muted-foreground">{t("لا توجد رسائل بعد")}</p>}
                {thread.map((m) => {
                  const mine = m.sender_id === me;
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[75%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                        {m.body}
                        <div className={`mt-1 text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                          {new Date(m.created_at).toLocaleString()}{mine && m.read_at ? ` · ${t("تمت القراءة")}` : ""}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>
              <div className="flex items-end gap-2 border-t border-border p-3">
                <Textarea autoFocus rows={1} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t("اكتب رسالة…")}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  className="max-h-40 min-h-10 resize-none" />
                <Button onClick={send} disabled={sending || !draft.trim()} size="icon" aria-label={t("إرسال")}><Send /></Button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
