import { useEffect } from "react";
import { translations, useLanguage } from "@/lib/i18n";

/**
 * Safety net for English mode: any on-screen text or placeholder that exactly
 * matches a known Arabic UI label is shown in English. Exact matches only, so
 * user-entered names and notes are never changed. Restores Arabic on switch back.
 */
const ATTRS = ["placeholder", "title", "aria-label"] as const;
const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "CODE", "PRE"]);
const AR = /[\u0600-\u06FF]/;

function lookup(text: string): string | null {
  const s = text.trim();
  if (!s || !AR.test(s)) return null;
  const hit = translations[s] ?? (s.endsWith(":") ? translations[s.slice(0, -1).trim()] && translations[s.slice(0, -1).trim()] + ":" : undefined);
  return hit ? text.replace(s, hit) : null;
}

export function AutoTranslate() {
  const language = useLanguage();
  useEffect(() => {
    if (language !== "en") return;
    const originals = new Map<Node, string>();
    const attrOriginals: Array<[Element, string, string]> = [];
    const skip = (el: Element | null) => !el || SKIP.has(el.tagName) || !!el.closest("[contenteditable],[data-no-translate]");
    const doText = (n: Node) => {
      if (skip(n.parentElement)) return;
      const next = lookup(n.nodeValue ?? "");
      if (next && next !== n.nodeValue) { if (!originals.has(n)) originals.set(n, n.nodeValue ?? ""); n.nodeValue = next; }
    };
    const doEl = (el: Element) => {
      for (const a of ATTRS) {
        const v = el.getAttribute(a);
        const next = v && lookup(v);
        if (next && next !== v) { attrOriginals.push([el, a, v!]); el.setAttribute(a, next); }
      }
    };
    const walk = (root: Node) => {
      if (root.nodeType === Node.TEXT_NODE) return doText(root);
      if (!(root instanceof Element) || skip(root)) return;
      doEl(root);
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
      for (let n = w.nextNode(); n; n = w.nextNode()) n.nodeType === Node.TEXT_NODE ? doText(n) : doEl(n as Element);
    };
    walk(document.body);
    const obs = new MutationObserver((list) => {
      for (const m of list) {
        if (m.type === "characterData") doText(m.target);
        else if (m.type === "attributes") doEl(m.target as Element);
        else m.addedNodes.forEach(walk);
      }
    });
    obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] });
    return () => {
      obs.disconnect();
      originals.forEach((v, n) => { if (n.isConnected) n.nodeValue = v; });
      attrOriginals.forEach(([el, a, v]) => el.setAttribute(a, v));
    };
  }, [language]);
  return null;
}
