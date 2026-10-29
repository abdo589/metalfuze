import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Plus, Users, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { t } from "@/lib/i18n";

/** Only this account may keep several accounts signed in on one device and switch between them. */
export const SWITCH_OWNER = "eilaf@metalfuze.local";
const KEY = "mf-switch-accounts";
type Saved = { id: string; email: string; name: string; refresh: string };

const read = (): Saved[] => { try { return JSON.parse(localStorage.getItem(KEY) || "[]") as Saved[]; } catch { return []; } };
const write = (xs: Saved[]) => localStorage.setItem(KEY, JSON.stringify(xs));
const nameOf = (s: Session) => (s.user.user_metadata?.["display_name"] as string) || s.user.email?.split("@")[0] || "";
const remember = (s: Session) => {
  const xs = read().filter((x) => x.id !== s.user.id);
  write([...xs, { id: s.user.id, email: s.user.email ?? "", name: nameOf(s), refresh: s.refresh_token }]);
};

export function AccountSwitcher({ session, toEmail }: { session: Session; toEmail: (u: string) => string }) {
  const [list, setList] = useState<Saved[]>([]);
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);

  const isOwner = session.user.email === SWITCH_OWNER;
  useEffect(() => {
    const xs = read();
    const ownerSaved = xs.some((x) => x.email === SWITCH_OWNER);
    if (isOwner || (ownerSaved && xs.some((x) => x.id === session.user.id))) { remember(session); setList(read()); }
    else { localStorage.removeItem(KEY); setList([]); }
  }, [session, isOwner]);

  if (!list.length) return null;

  async function switchTo(a: Saved) {
    remember(session);
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: a.refresh });
    if (error || !data.session) {
      write(read().filter((x) => x.id !== a.id)); setList(read());
      toast.error(t("انتهت جلسة هذا الحساب، أضفه مرة أخرى")); return;
    }
    remember(data.session); setOpen(false);
  }
  async function add(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    remember(session);
    const id = user.trim().toLowerCase().replace(/\s+/g, ".");
    const { data, error } = await supabase.auth.signInWithPassword({ email: id.includes("@") ? id : toEmail(id), password: pass });
    setBusy(false);
    if (error || !data.session) { toast.error(t("اسم المستخدم أو كلمة المرور غير صحيحة")); return; }
    remember(data.session); setUser(""); setPass(""); setOpen(false);
    toast.success(t("تمت إضافة الحساب"));
  }
  function forget(a: Saved) { write(read().filter((x) => x.id !== a.id)); setList(read()); }

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}><Users /> {t("تبديل الحساب")}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t("الحسابات")}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {list.map((a) => (
              <div key={a.id} className="flex items-center gap-2 rounded-lg border border-border p-2">
                <button type="button" disabled={a.id === session.user.id} onClick={() => void switchTo(a)}
                  className="flex-1 text-start text-sm disabled:opacity-100">
                  <b>{a.name}</b>{a.id === session.user.id && <span className="ms-2 text-xs text-primary">{t("الحالي")}</span>}
                  <div className="text-xs text-muted-foreground" dir="ltr">{a.email}</div>
                </button>
                {a.id !== session.user.id && a.email !== SWITCH_OWNER &&
                  <Button size="icon" variant="ghost" aria-label={t("إزالة")} onClick={() => forget(a)}><X /></Button>}
              </div>
            ))}
          </div>
          <form onSubmit={add} className="space-y-2 border-t border-border pt-3">
            <div className="text-sm font-medium">{t("إضافة حساب")}</div>
            <Input dir="ltr" placeholder={t("اسم المستخدم أو البريد الإلكتروني")} value={user} onChange={(e) => setUser(e.target.value)} required />
            <Input dir="ltr" type="password" placeholder={t("كلمة المرور")} value={pass} onChange={(e) => setPass(e.target.value)} required />
            <Button type="submit" className="w-full" disabled={busy}><Plus /> {busy ? t("جارٍ الدخول...") : t("إضافة حساب")}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
