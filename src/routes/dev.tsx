import { t, useLanguage, locale } from "@/lib/i18n";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { Bug, Globe, KeyRound, RefreshCw, Trash2, UserPlus, Users, Wrench } from "lucide-react";
import { LoginEvents } from "@/components/LoginEvents";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { ASSIGNABLE_ROLES, createUser, deleteUser, listUsers, setUserPassword, setUserRole, type AppUser } from "@/lib/users.functions";

export const Route = createFileRoute("/dev")({
  head: () => ({
    meta: [
      { title: "الأعطال وإعدادات الحسابات | Metal Fuze" },
      { name: "description", content: "صفحة المبرمج: بلاغات الأعطال وإدارة كل الحسابات." },
      { property: "og:title", content: "الأعطال وإعدادات الحسابات | Metal Fuze" },
      { property: "og:description", content: "صفحة المبرمج: بلاغات الأعطال وإدارة كل الحسابات." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DevPage,
});

const ROLE_LABEL: Record<string, string> = {
  admin: "مسؤول", hr: "موارد بشرية", viewer: "مشاهدة", manager: "مدير مشروع", accountant: "محاسب",
  executive: "تنفيذي", mail: "البريد فقط", sales: "مبيعات", developer: "مبرمج",
};
const STATUS_LABEL: Record<string, string> = { open: "جديد", in_progress: "جاري الإصلاح", fixed: "تم الإصلاح" };

type Bug = { id: string; reporter_name: string; kind: string; page: string; description: string; status: string; dev_note: string; created_at: string };

function genPassword() {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  return Array.from(crypto.getRandomValues(new Uint32Array(12)), (n) => c[n % c.length]).join("");
}

function DevPage() {
  useLanguage();
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold"><Wrench className="text-primary" /> {t("الأعطال وإعدادات الحسابات")}</h1>
      <Tabs defaultValue="bugs">
        <TabsList>
          <TabsTrigger value="bugs"><Bug /> {t("الأعطال")}</TabsTrigger>
          <TabsTrigger value="accounts"><Users /> {t("إعدادات الحسابات")}</TabsTrigger>
          <TabsTrigger value="logins"><Globe /> {t("الدخول والخروج")}</TabsTrigger>
        </TabsList>
        <TabsContent value="bugs"><Bugs /></TabsContent>
        <TabsContent value="accounts"><Accounts /></TabsContent>
        <TabsContent value="logins"><LoginEvents /></TabsContent>
      </Tabs>
    </div>
  );
}

function Bugs() {
  const [rows, setRows] = useState<Bug[] | null>(null);
  const [filter, setFilter] = useState<"all" | "user" | "auto">("all");
  const load = useCallback(async () => {
    const { data } = await supabase.from("bug_reports").select("*").order("created_at", { ascending: false }).limit(300);
    setRows((data ?? []) as Bug[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  const update = async (id: string, patch: Partial<Bug>) => {
    const { error } = await supabase.from("bug_reports").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(t("تعذر الحفظ")); else load();
  };
  const remove = async (id: string) => {
    if (!confirm(t("حذف البلاغ؟"))) return;
    await supabase.from("bug_reports").delete().eq("id", id); load();
  };

  const list = (rows ?? []).filter((r) => filter === "all" || r.kind === filter);
  const open = (rows ?? []).filter((r) => r.status !== "fixed").length;

  return (
    <div className="space-y-3 pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">{t("مفتوحة")}: <b className="text-foreground">{open}</b></span>
        <div className="ms-auto flex gap-1">
          {(["all", "user", "auto"] as const).map((f) => (
            <Button key={f} size="sm" variant={filter === f ? "secondary" : "ghost"} onClick={() => setFilter(f)}>
              {t(f === "all" ? "الكل" : f === "user" ? "بلاغات المستخدمين" : "أخطاء تلقائية")}
            </Button>
          ))}
          <Button size="icon" variant="ghost" onClick={load} aria-label={t("تحديث")}><RefreshCw /></Button>
        </div>
      </div>
      {rows === null && <p className="text-muted-foreground">{t("جارٍ التحميل...")}</p>}
      {rows && !list.length && <p className="rounded-xl border p-6 text-center text-muted-foreground">{t("لا توجد أعطال")}</p>}
      {list.map((r) => (
        <div key={r.id} className="space-y-2 rounded-2xl border bg-card p-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className={`rounded-full px-2 py-0.5 text-xs ${r.kind === "auto" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
              {t(r.kind === "auto" ? "خطأ تلقائي" : "بلاغ مستخدم")}
            </span>
            <b>{r.reporter_name}</b>
            <span className="text-muted-foreground" dir="ltr">{r.page}</span>
            <span className="text-muted-foreground">{new Date(r.created_at).toLocaleString(locale())}</span>
            <select className="ms-auto rounded-md border bg-background px-2 py-1" value={r.status} onChange={(e) => update(r.id, { status: e.target.value })}>
              {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
            </select>
            <Button size="icon" variant="ghost" className="text-destructive" aria-label={t("حذف")} onClick={() => remove(r.id)}><Trash2 /></Button>
          </div>
          <pre className="whitespace-pre-wrap break-words font-sans text-sm" dir="auto">{r.description}</pre>
          <Input defaultValue={r.dev_note} placeholder={t("ملاحظة المبرمج")} onBlur={(e) => e.target.value !== r.dev_note && update(r.id, { dev_note: e.target.value })} />
        </div>
      ))}
    </div>
  );
}

function Accounts() {
  const list = useServerFn(listUsers);
  const create = useServerFn(createUser);
  const remove = useServerFn(deleteUser);
  const setPw = useServerFn(setUserPassword);
  const setRole = useServerFn(setUserRole);
  const [users, setUsers] = useState<AppUser[] | null>(null);
  const [me, setMe] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [form, setForm] = useState({ name: "", username: "", password: genPassword(), role: "viewer" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setUsers(await list()); } catch (e) { setMsg({ ok: false, text: (e as Error).message || t("تعذر تحميل المستخدمين") }); }
  }, [list]);
  useEffect(() => { load(); supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? "")); }, [load]);

  const mainRole = (u: AppUser) => (u.roles.includes("developer") ? "developer" : u.roles[0] ?? "manager");

  async function onCreate(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      const r = await create({ data: { name: form.name, username: form.username, password: form.password } });
      if (!r.ok) setMsg({ ok: false, text: r.error });
      else {
        const fresh = await list();
        const u = fresh.find((x) => x.username === form.username.toLowerCase());
        if (u) await setRole({ data: { id: u.id, role: form.role } });
        setMsg({ ok: true, text: `${t("تم إنشاء حساب")} ${form.name} — ${form.username.toLowerCase()} / ${form.password}` });
        setForm({ name: "", username: "", password: genPassword(), role: "viewer" });
        load();
      }
    } catch (err) { setMsg({ ok: false, text: (err as Error).message }); }
    setBusy(false);
  }

  return (
    <div className="space-y-4 pt-3">
      {msg && <div className={`rounded-xl border p-3 text-sm ${msg.ok ? "border-primary/40 bg-primary/10" : "border-destructive/40 bg-destructive/10 text-destructive"}`} dir="auto">{msg.text}</div>}
      <form onSubmit={onCreate} className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-5">
        <h2 className="font-bold sm:col-span-5">{t("إضافة حساب جديد")}</h2>
        <Input placeholder={t("الاسم المعروض")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <Input placeholder={t("اسم المستخدم (إنجليزي)")} dir="ltr" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
        <Input placeholder={t("كلمة السر")} dir="ltr" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />
        <select className="rounded-md border bg-background px-2" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          {ASSIGNABLE_ROLES.map((r) => <option key={r} value={r}>{t(ROLE_LABEL[r] ?? r)}</option>)}
        </select>
        <Button type="submit" disabled={busy}><UserPlus /> {t("إنشاء الحساب")}</Button>
      </form>
      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead className="text-muted-foreground"><tr className="border-b text-start">
            <th className="p-3 text-start">{t("الاسم")}</th><th className="p-3 text-start">{t("اسم المستخدم")}</th><th className="p-3 text-start">{t("الصلاحية")}</th><th className="p-3 text-start">{t("آخر دخول")}</th><th className="p-3" />
          </tr></thead>
          <tbody>
            {users === null && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">{t("جارٍ التحميل...")}</td></tr>}
            {users?.map((u) => (
              <tr key={u.id} className="border-b last:border-0">
                <td className="p-3 font-medium">{u.name} {u.id === me && <span className="text-xs text-primary">{t("(أنت)")}</span>}</td>
                <td className="p-3" dir="ltr">{u.username}</td>
                <td className="p-3">
                  <select className="rounded-md border bg-background px-2 py-1" value={mainRole(u)} disabled={u.id === me}
                    onChange={async (e) => { const r = await setRole({ data: { id: u.id, role: e.target.value } }); if (!r.ok) toast.error(r.error); else toast.success(t("تم حفظ الصلاحية")); load(); }}>
                    {ASSIGNABLE_ROLES.map((r) => <option key={r} value={r}>{t(ROLE_LABEL[r] ?? r)}</option>)}
                  </select>
                </td>
                <td className="p-3">{u.lastSignIn ? new Date(u.lastSignIn).toLocaleDateString(locale()) : t("لم يدخل بعد")}</td>
                <td className="p-3"><div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={async () => {
                    const pw = prompt(`${t("كلمة السر الجديدة لـ")} ${u.name}:`, genPassword()); if (!pw) return;
                    const r = await setPw({ data: { id: u.id, password: pw } });
                    setMsg(r.ok ? { ok: true, text: `${t("كلمة السر الجديدة لـ")} ${u.name}: ${pw}` } : { ok: false, text: r.error });
                  }}><KeyRound /> {t("كلمة السر")}</Button>
                  {u.id !== me && <Button size="icon" variant="ghost" className="text-destructive" aria-label={t("حذف")} onClick={async () => {
                    if (!confirm(`${t("حذف حساب")} ${u.name}?`)) return;
                    const r = await remove({ data: { id: u.id } }); setMsg(r.ok ? { ok: true, text: `${t("تم حذف")} ${u.name}` } : { ok: false, text: r.error }); load();
                  }}><Trash2 /></Button>}
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
