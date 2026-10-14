export type Theme = "light" | "dark";

const KEY = "metalfuze.theme";
const DEFAULT: Theme = "dark";

/**
 * Runs in the document <head> before paint so the page never flashes the
 * wrong palette on load.
 */
export const themeScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(KEY)});if(t!=="light"&&t!=="dark"){t=${JSON.stringify(DEFAULT)}}var e=document.documentElement;e.classList.toggle("dark",t==="dark");e.style.colorScheme=t}catch(e){}})()`;

export function currentTheme(): Theme {
  if (typeof document === "undefined") return DEFAULT;
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function setTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* private mode — the switch still works for this visit */
  }
}
