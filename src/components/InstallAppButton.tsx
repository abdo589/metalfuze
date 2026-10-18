import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { t, useLanguage } from "@/lib/i18n";

type PromptEvent = Event & { prompt: () => Promise<void> };

/** Installs the site as a home-screen app; shows a short guide where the browser has no prompt (iPhone). */
export function InstallAppButton() {
  useLanguage();
  const [installed, setInstalled] = useState(true);
  const [prompt, setPrompt] = useState<PromptEvent | null>(null);
  const [guide, setGuide] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const onPrompt = (e: Event) => { e.preventDefault(); setPrompt(e as PromptEvent); };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  async function onClick() {
    if (prompt) { await prompt.prompt(); setPrompt(null); return; }
    setGuide(true);
  }

  return (
    <>
      <Button variant="outline" size="sm" className="justify-start gap-2" onClick={onClick}>
        <Download className="size-4" /> {t("تثبيت التطبيق")}
      </Button>
      <Dialog open={guide} onOpenChange={setGuide}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{ios ? t("تثبيت على الآيفون") : t("تثبيت التطبيق")}</DialogTitle></DialogHeader>
          {ios ? (
            <ol className="space-y-2 text-sm">
              <li>{t("١. اضغط زر المشاركة أسفل Safari")}</li>
              <li>{t("٢. اختر «إضافة إلى الشاشة الرئيسية»")}</li>
              <li>{t("٣. اضغط «إضافة» — سيظهر شعار Metal Fuze على شاشتك")}</li>
            </ol>
          ) : (
            <p className="text-sm">{t("على الكمبيوتر أو أندرويد: افتح قائمة المتصفح واختر «تثبيت التطبيق».")}</p>
          )}
          <DialogFooter><Button onClick={() => setGuide(false)}>{t("تم")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
