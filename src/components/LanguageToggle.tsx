import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setLanguage, useLanguage } from "@/lib/i18n";

export function LanguageToggle() {
  const language = useLanguage();
  return <Button variant="outline" className="print:hidden" aria-label={language === "ar" ? "Switch to English" : "التبديل للعربية"}
    onClick={() => setLanguage(language === "ar" ? "en" : "ar")}><Languages />{language === "ar" ? "English" : "العربية"}</Button>;
}