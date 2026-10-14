import { useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { LogOut, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const DOMAIN = "metalfuze.local";
export const toEmail = (u: string) => `${u.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "")}@${DOMAIN}`;

export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getUser().then(async ({ data: u }) => {
      if (!u.user) return setSession(null);
      const { data: s } = await supabase.auth.getSession();
      setSession(s.session);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (session === undefined) return <div className="min-h-screen" />;
  if (!session) return <Login />;

  const name = (session.user.user_metadata?.display_name as string) || session.user.email?.split("@")[0];
  return (
    <>
      <div className="flex items-center justify-end gap-2 px-4 pt-3 text-sm text-muted-foreground print:hidden sm:px-6">
        <span>مرحباً، <b className="text-foreground">{name}</b></span>
        <Button size="sm" variant="ghost" onClick={() => supabase.auth.signOut()}><LogOut /> خروج</Button>
      </div>
      {children}
    </>
  );
}

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email: toEmail(username), password });
    setBusy(false);
    if (error) setError("اسم المستخدم أو كلمة المرور غير صحيحة");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-6 shadow-lg">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="rounded-full bg-primary/15 p-3 text-primary"><Lock /></div>
          <h1 className="font-display text-2xl font-extrabold">تسجيل الدخول</h1>
          <p className="text-sm text-muted-foreground">لوحة متابعة مشاريع Metal Fuze</p>
        </div>
        <Input placeholder="اسم المستخدم" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" dir="ltr" required />
        <Input placeholder="كلمة المرور" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" dir="ltr" required />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "جارٍ الدخول..." : "دخول"}</Button>
      </form>
    </div>
  );
}
