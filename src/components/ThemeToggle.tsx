import { t, useLanguage, locale } from "@/lib/i18n";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { currentTheme, setTheme, type Theme } from "@/lib/theme";

export function ThemeToggle() {
  useLanguage();
  const [theme, setThemeState] = useState<Theme>("dark");

  // Read the real value after mount so server and client markup match.
  useEffect(() => setThemeState(currentTheme()), []);

  const next: Theme = theme === "dark" ? "light" : "dark";

  return (
    <Button
      variant="outline"
      onClick={() => {
        setTheme(next);
        setThemeState(next);
      }}
      aria-label={next === "light" ? t("تفعيل الوضع الفاتح") : t("تفعيل الوضع الداكن")}
      title={next === "light" ? t("الوضع الفاتح") : t("الوضع الداكن")}
    >
      {theme === "dark" ? <Sun /> : <Moon />}
      {next === "light" ? t("فاتح") : t("داكن")}
    </Button>
  );
}
