import { t, useLanguage, locale } from "@/lib/i18n";
import { useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { Eye, EyeOff, LogOut } from "lucide-react";
import logoAsset from "@/assets/metal-fuze-logo.png.asset.json";
import logoLightAsset from "@/assets/metal-fuze-logo-light.png.asset.json";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { HR_PATHS, MANAGER_PATHS, ACCOUNTANT_PATHS, EXECUTIVE_PATHS, useRole } from "@/lib/permissions";
import { oauthReturnPath } from "@/lib/oauth-return-path";

/** HR-only accounts may open only the HR pages; anything else sends them to payroll. */
function RoleGuard({ children }: { children: ReactNode }) {
  const role = useRole();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const allowed = role === "hr" ? HR_PATHS : role === "manager" ? MANAGER_PATHS : role === "accountant" ? ACCOUNTANT_PATHS : role === "executive" ? EXECUTIVE_PATHS : null;
  const blocked = !!allowed && !pathname.startsWith("/.lovable/oauth") && !allowed.some((p) => pathname.startsWith(p));
  const home = role === "executive" ? "/executive" : role === "accountant" ? "/accounting" : role === "manager" ? "/my-projects" : "/payroll";
  useEffect(() => { if (blocked) navigate({ to: home, replace: true }); }, [blocked, home, navigate]);
  if (role === undefined || blocked) return <div className="min-h-screen" />;
  return <>{children}</>;
}

const DOMAIN = "metalfuze.local";
export const toEmail = (u: string) => `${u.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "")}@${DOMAIN}`;

export function AuthGate({ children }: { children: ReactNode }) {
  useLanguage();
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

  const name = (session.user.user_metadata?.["display_name"] as string) || session.user.email?.split("@")[0];
  return (
    <>
      <div className="flex items-center justify-end gap-2 px-4 pt-3 text-sm text-muted-foreground print:hidden sm:px-6">
        <span>{t("مرحباً،")}<b className="text-foreground">{name}</b></span>
        <Button size="sm" variant="ghost" onClick={() => supabase.auth.signOut()}><LogOut /> {t("خروج")}</Button>
      </div>
      <RoleGuard>{children}</RoleGuard>
    </>
  );
}

function Login() {
  useLanguage();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [signup, setSignup] = useState(false);
  const [fullName, setFullName] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    if (signup) {
      const mail = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) { setBusy(false); return setError(t("بريد إلكتروني غير صحيح")); }
      if (password.length < 8) { setBusy(false); return setError(t("كلمة السر 8 أحرف على الأقل")); }
      const { data, error } = await supabase.auth.signUp({
        email: mail, password,
        options: { emailRedirectTo: window.location.origin, data: { display_name: fullName.trim().slice(0, 80), self_signup: "true" } },
      });
      setBusy(false);
      if (error) setError(error.message.includes("already") ? t("البريد الإلكتروني مستخدم بالفعل") : error.message.includes("weak") || error.message.includes("pwned") ? t("كلمة السر ضعيفة أو مسربة، اختر غيرها") : t("تعذر إنشاء الحساب"));
      else if (!data.session) setNotice(t("تم إنشاء الحساب — تحقق من بريدك الإلكتروني لتفعيله"));
      return;
    }
    const id = username.trim().toLowerCase();
    const mail = id.includes("@") ? id : toEmail(id);
    const { error } = await supabase.auth.signInWithPassword({ email: mail, password });
    setBusy(false);
    if (error) setError(t("اسم المستخدم أو كلمة المرور غير صحيحة"));
  }

  async function onGoogle(provider: "google" | "microsoft" = "google") {
    setGoogleBusy(true);
    setError("");
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.pathname.startsWith("/.lovable/oauth") ? new URL(oauthReturnPath(window.location.pathname + window.location.search), window.location.origin).href : window.location.origin,
    });
    if (result.error) {
      setGoogleBusy(false);
      setError(provider === "microsoft" ? t("تعذر الدخول بحساب Outlook، حاول مرة أخرى") : t("تعذر الدخول بحساب جوجل، حاول مرة أخرى"));
      return;
    }
    if (result.redirected) return; // Browser is heading to Google
    // Popup flow: session is already set; onAuthStateChange picks it up.
    setGoogleBusy(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-6 shadow-lg">
        <div className="flex flex-col items-center gap-2 text-center">
          <img src={logoAsset.url} alt="Metal Fuze — Accuracy Has No Limit" width={1600} height={665}
            className="screen-logo logo-on-light mx-auto h-auto w-60" />
          <img src={logoLightAsset.url} alt="Metal Fuze — Accuracy Has No Limit" width={1600} height={665}
            className="screen-logo logo-on-dark mx-auto hidden h-auto w-60" />

          <h1 className="font-display text-2xl font-extrabold">{signup ? t("إنشاء حساب مدير مشروع") : t("تسجيل الدخول")}</h1>
          <p className="text-sm text-muted-foreground">{t("لوحة متابعة مشاريع Metal Fuze")}</p>
        </div>
        {signup && <Input placeholder={t("الاسم الكامل")} value={fullName} onChange={(e) => setFullName(e.target.value)} required />}
        {signup
          ? <Input placeholder={t("البريد الإلكتروني")} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" dir="ltr" required />
          : <Input placeholder={t("اسم المستخدم أو البريد الإلكتروني")} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" dir="ltr" required />}
        <div dir="ltr" className="relative">
          <Input placeholder={t("كلمة المرور")} type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" dir="ltr" required className="pe-10" />
          <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? t("إخفاء كلمة المرور") : t("إظهار كلمة المرور")} aria-pressed={showPassword}
            className="absolute end-1 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {notice && <p className="text-sm text-primary" dir="auto">{notice}</p>}
        <Button type="submit" className="w-full" disabled={busy || googleBusy}>{signup ? (busy ? t("جارٍ الإنشاء...") : t("إنشاء حساب")) : busy ? t("جارٍ الدخول...") : t("دخول")}</Button>
        <button type="button" onClick={() => { setSignup((v) => !v); setError(""); setNotice(""); setEmail(""); }} className="w-full text-center text-sm text-primary hover:underline">
          {signup ? t("لديك حساب؟ سجل الدخول") : t("مدير مشروع؟ أنشئ حسابك")}
        </button>
        <div className="flex items-center gap-3 py-1">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">{t("أو")}</span>
          <div className="h-px flex-1 bg-border" />
        </div>
        <Button type="button" variant="outline" className="w-full" disabled={busy || googleBusy} onClick={() => onGoogle("google")}>
          <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
            <path fill="#4285F4" d="M23.06 12.25c0-.85-.08-1.67-.22-2.45H12v4.64h6.2a5.3 5.3 0 0 1-2.3 3.48v2.9h3.72c2.17-2 3.44-4.95 3.44-8.57Z" />
            <path fill="#34A853" d="M12 23.5c3.1 0 5.7-1.03 7.6-2.78l-3.72-2.9c-1.03.7-2.36 1.1-3.88 1.1-2.98 0-5.5-2.01-6.4-4.72H1.76v2.99A11.5 11.5 0 0 0 12 23.5Z" />
            <path fill="#FBBC05" d="M5.6 14.2a6.9 6.9 0 0 1 0-4.4V6.81H1.76a11.5 11.5 0 0 0 0 10.38L5.6 14.2Z" />
            <path fill="#EA4335" d="M12 5.08c1.68 0 3.19.58 4.38 1.71l3.28-3.28C17.68 1.63 15.1.5 12 .5A11.5 11.5 0 0 0 1.76 6.81L5.6 9.8c.9-2.71 3.42-4.72 6.4-4.72Z" />
          </svg>
          {googleBusy ? t("جارٍ فتح جوجل...") : t("الدخول بحساب جوجل")}
        </Button>
        <Button type="button" variant="outline" className="w-full" disabled={busy || googleBusy} onClick={() => onGoogle("microsoft")}>
          <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
            <path fill="#F25022" d="M1 1h10.5v10.5H1z" /><path fill="#7FBA00" d="M12.5 1H23v10.5H12.5z" />
            <path fill="#00A4EF" d="M1 12.5h10.5V23H1z" /><path fill="#FFB900" d="M12.5 12.5H23V23H12.5z" />
          </svg>
          {t("الدخول بحساب Outlook / Microsoft")}
        </Button>
      </form>
    </div>
  );
}
