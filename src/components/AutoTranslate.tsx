import { useEffect } from "react";
import { translations, useLanguage } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

// Machine translations of names/notes, cached on this device.
const CACHE_KEY = "metalfuze.autotr";
let cache: Record<string, string> = {};
try { cache = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}"); } catch { /* ignore */ }
const pending = new Set<string>(); const inflight = new Set<string>();
let timer: ReturnType<typeof setTimeout> | undefined;
let onArrive: (() => void) | null = null;
function queue(s: string) {
  if (inflight.has(s) || s.length > 500) return;
  pending.add(s);
  clearTimeout(timer);
  timer = setTimeout(flush, 400);
}
async function flush() {
  const batch = [...pending].slice(0, 80); batch.forEach((b) => { pending.delete(b); inflight.add(b); });
  if (pending.size) timer = setTimeout(flush, 400);
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token || !batch.length) return;
  try {
    const r = await fetch("/api/translate", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ texts: batch }) });
    if (r.ok) { const { map } = await r.json(); Object.assign(cache, map); try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch { /* full */ } onArrive?.(); }
  } catch { /* offline */ }
}

/**
 * Safety net for English mode: any on-screen text or placeholder that exactly
 * is shown in English: UI labels from the dictionary, everything else (names,
 * notes) via /api/translate. Display only — stored data stays as entered.
 */
const ATTRS = ["placeholder", "title", "aria-label"] as const;
const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "CODE", "PRE"]);
const AR = /[\u0600-\u06FF]/;

function lookup(text: string): string | null {
  const s = text.trim();
  if (!s || !AR.test(s)) return null;
  const hit = translations[s] ?? (s.endsWith(":") ? translations[s.slice(0, -1).trim()] && translations[s.slice(0, -1).trim()] + ":" : undefined);
  if (hit) return text.replace(s, hit);
  if (cache[s]) return text.replace(s, cache[s]);
  queue(s);
  return null;
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
    onArrive = () => walk(document.body);
    const obs = new MutationObserver((list) => {
      for (const m of list) {
        if (m.type === "characterData") doText(m.target);
        else if (m.type === "attributes") doEl(m.target as Element);
        else m.addedNodes.forEach(walk);
      }
    });
    obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] });
    return () => {
      obs.disconnect(); onArrive = null;
      originals.forEach((v, n) => { if (n.isConnected) n.nodeValue = v; });
      attrOriginals.forEach(([el, a, v]) => el.setAttribute(a, v));
    };
  }, [language]);
  return null;
}
