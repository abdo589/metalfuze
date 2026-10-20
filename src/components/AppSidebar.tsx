import { t, useLanguage } from "@/lib/i18n";
import { Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import {
  Banknote,
  Bell,
  HandCoins,
  BrainCircuit,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  PieChart,
  Fingerprint, Smartphone, Landmark, IdCard, CalendarOff,
  Users, FolderKanban, MessageSquare, Calculator,
  Radar,
  Mail, Star, FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { InstallAppButton } from "@/components/InstallAppButton";
import { setSidebar, useSidebar } from "@/lib/sidebar";
import { HR_PATHS, useRole } from "@/lib/permissions";
import { useUnreadMessages } from "@/lib/unread-messages";
import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ALERT_DAYS, daysLeft } from "@/lib/residency";
import logoAsset from "@/assets/metal-fuze-logo.png.asset.json";
import logoLightAsset from "@/assets/metal-fuze-logo-light.png.asset.json";

const items = [
  { to: "/hr-dashboard", label: "لوحة التحكم", icon: Bell },
  { to: "/hr-file", label: "بيانات الموظفين", icon: IdCard },
  { to: "/leaves", label: "الإجازات", icon: CalendarOff },
  { to: "/documents", label: "الوثائق", icon: FolderOpen },
  { to: "/performance", label: "تقييم الأداء", icon: Star },
  { to: "/messages", label: "الرسائل", icon: MessageSquare },
  { to: "/mail", label: "البريد (Outlook)", icon: Mail },
  { to: "/attendance", label: "الحضور والانصراف", icon: Fingerprint },
  { to: "/attendance-tracking", label: "تتبع الحضور", icon: Radar },
  { to: "/payroll", label: "الرواتب", icon: Banknote },
  { to: "/workers-checkin", label: "تسجيل حضور العمال", icon: Smartphone },
  { to: "/settlements", label: "المخالصات", icon: FileText },
  { to: "/", label: "لوحة المشاريع", icon: LayoutDashboard },
  { to: "/payments", label: "الدفع والتحصيل", icon: HandCoins },
  { to: "/bank", label: "رصيد البنك", icon: Landmark },
  { to: "/report", label: "التقرير الشهري", icon: FileText },
  { to: "/budget", label: "الميزانية", icon: PieChart },
  { to: "/project-reports", label: "تقارير المشاريع", icon: FileSpreadsheet },
  { to: "/assistant", label: "المستشار الذكي", icon: BrainCircuit },
  { to: "/users", label: "المستخدمون", icon: Users },
  { to: "/my-projects", label: "مشاريع المديرين", icon: FolderKanban },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const role = useRole();
  const unread = useUnreadMessages();
  const visible = role === "hr" ? items.filter((i) => HR_PATHS.includes(i.to))
    : role === "mail" ? [{ to: "/mail", label: "البريد (Outlook)", icon: Mail }]
    : role === "executive" ? [{ to: "/executive", label: "الملخص التنفيذي", icon: Calculator }, { to: "/messages", label: "الرسائل", icon: MessageSquare }, { to: "/mail", label: "البريد (Outlook)", icon: Mail }]
    : role === "accountant" ? [{ to: "/accounting", label: "المحاسبة", icon: Calculator }, { to: "/messages", label: "الرسائل", icon: MessageSquare }, { to: "/mail", label: "البريد (Outlook)", icon: Mail }]
    : role === "manager" ? [{ to: "/my-projects", label: "مشاريعي", icon: FolderKanban }, { to: "/messages", label: "الرسائل", icon: MessageSquare }, { to: "/mail", label: "البريد (Outlook)", icon: Mail }]
    : role === undefined ? [] : role === "admin" ? items : items.filter((i) => i.to !== "/my-projects");
  return (
    <nav className="-mx-1 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain px-1">
      {visible.map((it) => {
        const active = it.to === "/" ? pathname === "/" : pathname.startsWith(it.to);
        const badge = it.to === "/messages" ? unread : 0;
        return (
          <Button key={it.to} variant={active ? "secondary" : "ghost"} asChild
            className="w-full justify-start gap-3" aria-current={active ? "page" : undefined}>
            <Link to={it.to} onClick={onNavigate}>
              <it.icon /> {t(it.label)}
              {badge > 0 && (
                <span aria-label={`${badge} ${t("رسائل غير مقروءة")}`}
                  className="ms-auto inline-flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 py-0.5 text-[11px] font-semibold leading-none text-destructive-foreground">
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </Link>
          </Button>
        );
      })}
    </nav>
  );
}

function Logo({ className = "w-36" }: { className?: string }) {
  return (
    <Link to="/" className="block">
      <img src={logoAsset.url} alt="Metal Fuze — Accuracy Has No Limit" width={1600} height={665}
        className={`screen-logo logo-on-light mx-auto h-auto ${className}`} />
      <img src={logoLightAsset.url} alt="Metal Fuze — Accuracy Has No Limit" width={1600} height={665}
        className={`screen-logo logo-on-dark mx-auto hidden h-auto ${className}`} />
    </Link>
  );
}

function NotifyButton() {
  const [perm, setPerm] = useState<string>("unsupported");
  useEffect(() => { if ("Notification" in window) setPerm(Notification.permission); }, []);
  if (perm === "unsupported" || perm === "granted") return null;
  return (
    <Button variant="outline" size="sm" onClick={async () => {
      if (window.top !== window.self) { toast.info(t("افتح التطبيق المثبت أو الموقع في نافذة مستقلة لتفعيل التنبيهات")); return; }
      const p = await Notification.requestPermission();
      setPerm(p);
      if (p === "granted") {
        sessionStorage.removeItem("res-alert");
        new Notification("Metal Fuze", { body: t("تم تفعيل تنبيهات الإقامات على الجهاز"), icon: "/icon-192.png" });
      } else toast.error(t("التنبيهات مرفوضة — فعّلها من إعدادات الموقع في المتصفح"));
    }}>🔔 {t("تفعيل تنبيهات الجهاز")}</Button>
  );
}

export function AppSidebar() {
  const language = useLanguage();
  const [open, setOpen] = useState(false);
  const collapsed = useSidebar() === "hidden";
  const role = useRole();
  useEffect(() => {
    if (!role || sessionStorage.getItem("res-alert")) return;
    sessionStorage.setItem("res-alert", "1");
    supabase.from("residencies").select("name,iqama_expiry,permit_expiry,insurance_expiry,contract_expiry").then(({ data }) => {
      const n = (data ?? []).filter((r) => [r.iqama_expiry, r.permit_expiry, r.insurance_expiry, r.contract_expiry]
        .some((d) => { const x = daysLeft(d); return x !== null && x <= ALERT_DAYS; })).length;
      if (!n) return;
      const msg = `${t("تنبيه: مستندات قاربت على الانتهاء أو منتهية لـ")} ${n} ${t("موظف")}`;
      toast.warning(msg, {
        duration: 15000, action: { label: t("عرض"), onClick: () => { window.location.href = "/hr-dashboard"; } } });
      // System notification on the laptop/phone screen (works in the installed app once allowed).
      if ("Notification" in window && Notification.permission === "granted") {
        const note = new Notification("Metal Fuze", { body: msg, icon: "/icon-192.png", tag: "res-alert" });
        note.onclick = () => { window.focus(); window.location.href = "/hr-dashboard"; };
      }
    });
  }, [role]);

  return (
    <>
      {/* Desktop: fixed side rail on the page start side (right in Arabic, left in English). */}
      <aside className="sidebar-rail sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 overflow-hidden border-e bg-card/40 p-4 lg:flex print:hidden">
        <div className="flex items-start justify-between gap-1">
          <Logo />
          <Button size="icon" variant="ghost" className="shrink-0" aria-label={t("إخفاء القائمة")}
            title={t("إخفاء القائمة")} onClick={() => setSidebar("hidden")}>
            <PanelLeftClose />
          </Button>
        </div>
        <NavLinks />
        <div className="flex shrink-0 flex-col items-stretch gap-2 border-t pt-4">
          <InstallAppButton />
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </aside>

      {/* Desktop collapsed: a narrow rail holding the single icon that brings the menu back. */}
      <div className="sidebar-rail-mini sticky top-0 hidden h-dvh w-12 shrink-0 flex-col items-center border-e bg-card/40 py-3 lg:flex print:hidden">
        <Button size="icon" variant="ghost" aria-label={t("إظهار القائمة")} title={t("إظهار القائمة")}
          onClick={() => setSidebar("visible")}>
          <PanelLeftOpen />
        </Button>
      </div>

      {/* Mobile: top bar with a slide-in menu holding the same links. */}
      <header className="sticky top-0 z-40 flex items-center justify-between gap-2 border-b bg-background/90 px-3 py-2 backdrop-blur lg:hidden print:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button size="icon" variant="ghost" aria-label={t("القائمة")}><Menu /></Button>
          </SheetTrigger>
          <SheetContent side={language === "ar" ? "right" : "left"} className="w-64 p-4">
            <SheetTitle className="sr-only">{t("القائمة")}</SheetTitle>
            <div className="flex h-full min-h-0 flex-col gap-6">
              <Logo className="w-32" />
              <NavLinks onNavigate={() => setOpen(false)} />
              <div className="flex shrink-0 flex-col gap-2 border-t pt-4">
                <InstallAppButton />
          <LanguageToggle />
                <ThemeToggle />
              </div>
            </div>
          </SheetContent>
        </Sheet>
        <Logo className="w-28" />
        <span className="size-9 shrink-0" aria-hidden="true" />
      </header>
    </>
  );
}
