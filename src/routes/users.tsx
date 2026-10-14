import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, KeyRound, RefreshCw, Trash2, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createUser, deleteUser, listUsers, setUserPassword, type AppUser } from "@/lib/users.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/users")({
  head: () => ({
    meta: [
      { title: "إدارة المستخدمين | Metal Fuze" },
      { name: "description", content: "إضافة وحذف حسابات المسؤولين وتغيير كلمات السر." },
      { property: "og:title", content: "إدارة المستخدمين | Metal Fuze" },
      { property: "og:description", content: "إضافة وحذف حسابات المسؤولين وتغيير كلمات السر." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UsersPage,
});

function genPassword() {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const a = crypto.getRandomValues(new Uint32Array(12));
  return Array.from(a, (n) => c[n % c.length]).join("");
}

function UsersPage() {
  const list = useServerFn(listUsers);
  const create = useServerFn(createUser);
  const remove = useServerFn(deleteUser);
  const setPw = useServerFn(setUserPassword);
  const [users, setUsers] = useState<AppUser[] | null>(null);
  const [me, setMe] = useState<string>("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [form, setForm] = useState({ name: "", username: "", password: genPassword() });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setUsers(await list()); } catch { setMsg({ ok: false, text: "تعذر تحميل المستخدمين" }); }
  }, [list]);
  useEffect(() => {
    load();
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? ""));
  }, [load]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const r = await create({ data: form });
      if (!r.ok) setMsg({ ok: false, text: r.error });
      else {
        setMsg({ ok: true, text: `تم إنشاء حساب ${form.name} — اسم المستخدم: ${form.username.toLowerCase()} / كلمة السر: ${form.password}` });
        setForm({ name: "", username: "", password: genPassword() });
        load();
      }
    } catch (err) { setMsg({ ok: false, text: (err as Error).message }); }
    setBusy(false);
  }

  async function onDelete(u: AppUser) {
    if (!confirm(`حذف حساب ${u.name}؟`)) return;
    const r = await remove({ data: { id: u.id } });
    setMsg(r.ok ? { ok: true, text: `تم حذف ${u.name}` } : { ok: false, text: r.error });
    load();
  }

  async function onReset(u: AppUser) {
    const pw = prompt(`كلمة السر الجديدة لـ ${u.name} (8 أحرف على الأقل):`, genPassword());
    if (!pw) return;
    try {
      const r = await setPw({ data: { id: u.id, password: pw } });
      setMsg(r.ok ? { ok: true, text: `كلمة السر الجديدة لـ ${u.name}: ${pw}` } : { ok: false, text: r.error });
    } catch (err) { setMsg({ ok: false, text: (err as Error).message }); }
  }

  const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString("ar-EG", { dateStyle: "medium" }) : "لم يدخل بعد");

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold"><Users className="text-primary" /> إدارة المستخدمين</h1>
        <Button asChild variant="outline"><Link to="/"><ArrowRight /> لوحة المشاريع</Link></Button>
      </div>

      {msg && (
        <div className={`rounded-xl border p-3 text-sm ${msg.ok ? "border-primary/40 bg-primary/10" : "border-destructive/40 bg-destructive/10 text-destructive"}`} dir="auto">{msg.text}</div>
      )}

      <form onSubmit={onCreate} className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-4">
        <h2 className="font-bold sm:col-span-4">إضافة حساب جديد</h2>
        <Input placeholder="الاسم المعروض" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <Input placeholder="اسم المستخدم (إنجليزي)" dir="ltr" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
        <div className="flex gap-1">
          <Input placeholder="كلمة السر" dir="ltr" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />
          <Button type="button" variant="ghost" size="icon" title="توليد" onClick={() => setForm({ ...form, password: genPassword() })}><RefreshCw /></Button>
        </div>
        <Button type="submit" disabled={busy}><UserPlus /> {busy ? "جارٍ الإنشاء..." : "إنشاء الحساب"}</Button>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="text-muted-foreground">
            <tr className="border-b border-border text-right">
              <th className="p-3">الاسم</th><th className="p-3">اسم المستخدم</th><th className="p-3">تاريخ الإنشاء</th><th className="p-3">آخر دخول</th><th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {users === null && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">جارٍ التحميل...</td></tr>}
            {users?.map((u) => (
              <tr key={u.id} className="border-b border-border last:border-0">
                <td className="p-3 font-medium">{u.name} {u.id === me && <span className="text-xs text-primary">(أنت)</span>}</td>
                <td className="p-3" dir="ltr">{u.username}</td>
                <td className="p-3">{fmt(u.createdAt)}</td>
                <td className="p-3">{fmt(u.lastSignIn)}</td>
                <td className="p-3">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => onReset(u)}><KeyRound /> كلمة السر</Button>
                    {u.id !== me && <Button size="icon" variant="ghost" className="text-destructive" title="حذف" onClick={() => onDelete(u)}><Trash2 /></Button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">كلمة السر تظهر مرة واحدة فقط عند الإنشاء أو التغيير — سلّمها لصاحب الحساب مباشرة.</p>
    </div>
  );
}
