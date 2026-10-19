import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, MapPin } from "lucide-react";
import logoAsset from "@/assets/metal-fuze-logo.png.asset.json";
import logoLightAsset from "@/assets/metal-fuze-logo-light.png.asset.json";
import { SelfieCheckin } from "@/components/SelfieCheckin";
import { LanguageToggle } from "@/components/LanguageToggle";
import { t, useLanguage, locale } from "@/lib/i18n";
import { checkinError } from "@/lib/checkin-client";

export const Route = createFileRoute("/checkin/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "تسجيل الحضور — Metal Fuze" },
      { name: "description", content: "تسجيل حضور وانصراف موظفي Metal Fuze من الجوال." },
      { property: "og:title", content: "تسجيل الحضور — Metal Fuze" },
      { property: "og:description", content: "سجّل حضورك وانصرافك من موقع العمل." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Checkin,
});

function Checkin() {
  useLanguage();
  const { token } = Route.useParams();
  const [info, setInfo] = useState<{ name: string; site: string | null } | null | "invalid">(null);
  const [now, setNow] = useState(new Date());
  const [done, setDone] = useState<{ action: "in" | "out"; time: string; site: string } | null>(null);

  const [tracking, setTracking] = useState(false);
  // While on shift and the page is open, send the phone's location every 3 minutes.
  useEffect(() => {
    if (info === null || info === "invalid") return;
    let alive = true;
    const send = () => navigator.geolocation?.getCurrentPosition(async (p) => {
      const r = await fetch("/api/public/checkin", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action: "ping", lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }) }).catch(() => null);
      const j = await r?.json().catch(() => null);
      if (alive && j) setTracking(!!j.onShift);
    }, () => {}, { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 });
    send();
    const id = setInterval(send, 180_000);
    return () => { alive = false; clearInterval(id); };
  }, [info, token, done]);

  useEffect(() => {
    fetch(`/api/public/checkin?token=${encodeURIComponent(token)}`).then(async (r) => setInfo(r.ok ? await r.json() : "invalid")).catch(() => setInfo("invalid"));
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [token]);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-5">
      <div className="flex items-center justify-between">
        <img src={logoAsset.url} alt="Metal Fuze" className="logo-on-light h-10 w-auto" />
        <img src={logoLightAsset.url} alt="Metal Fuze" className="logo-on-dark h-10 w-auto" />
        <LanguageToggle />
      </div>
      {info === null ? <div className="py-20 text-center text-muted-foreground">…</div>
        : info === "invalid" ? <p className="rounded-xl bg-destructive/10 p-6 text-center text-destructive">{checkinError("invalid")}</p>
        : (
          <>
            <div className="rounded-xl border border-border bg-card p-5 text-center">
              <div className="text-sm text-muted-foreground">{t("مرحباً،")}</div>
              <div className="font-display text-2xl font-bold">{info.name}</div>
              <div className="mt-3 font-display text-4xl font-extrabold tabular-nums" dir="ltr">
                {now.toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </div>
              <div className="text-sm text-muted-foreground">{now.toLocaleDateString(locale(), { dateStyle: "full" })}</div>
              <div className="mt-3 flex items-center justify-center gap-1 text-sm"><MapPin className="size-4" /> {info.site ?? t("لم يتم تحديد موقع العمل")}</div>
            </div>
            {done && (
              <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success/10 p-4 text-success">
                <CheckCircle2 className="size-6 shrink-0" />
                <div>
                  <div className="font-bold">{done.action === "in" ? t("تم تسجيل الحضور") : t("تم تسجيل الانصراف")}</div>
                  <div className="text-sm">{new Date(done.time).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" })} — {done.site}</div>
                </div>
              </div>
            )}
            {tracking && (
              <p className="flex items-center justify-center gap-2 rounded-lg bg-primary/10 p-2 text-sm text-primary">
                <MapPin className="size-4 animate-pulse" /> {t("تتبع موقعك شغال أثناء الدوام — اترك الصفحة مفتوحة")}
              </p>
            )}
            <SelfieCheckin onSubmit={async (d) => {
              const r = await fetch("/api/public/checkin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, ...d }) });
              const j = await r.json().catch(() => ({ ok: false, error: "save" }));
              if (!j.ok) throw new Error(checkinError(j.error));
              setDone({ action: d.action, time: j.time, site: j.site });
            }} />
          </>
        )}
    </div>
  );
}
