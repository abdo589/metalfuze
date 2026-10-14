import { useSyncExternalStore } from "react";
import type { UIMessage } from "ai";

export type Thread = { id: string; title: string; updatedAt: number; messages: UIMessage[] };

const KEY = "metalfuze.ai-threads.v1";
const listeners = new Set<() => void>();
let cache: Thread[] | null = null;
const EMPTY: Thread[] = [];

function load(): Thread[] {
  if (typeof window === "undefined") return EMPTY;
  if (cache) return cache;
  try { cache = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { cache = []; }
  return cache!;
}
function save(list: Thread[]) {
  cache = [...list].sort((a, b) => b.updatedAt - a.updatedAt);
  localStorage.setItem(KEY, JSON.stringify(cache));
  listeners.forEach((l) => l());
}

export const threadStore = {
  all: load,
  get: (id: string) => load().find((t) => t.id === id),
  create(): string {
    const id = crypto.randomUUID().slice(0, 8);
    save([{ id, title: "محادثة جديدة", updatedAt: Date.now(), messages: [] }, ...load()]);
    return id;
  },
  ensure(id: string) {
    if (!load().some((t) => t.id === id)) save([{ id, title: "محادثة جديدة", updatedAt: Date.now(), messages: [] }, ...load()]);
  },
  setMessages(id: string, messages: UIMessage[]) {
    const first = messages.find((m) => m.role === "user");
    const text = first?.parts.map((p) => (p.type === "text" ? p.text : "")).join(" ").trim();
    save(load().map((t) => t.id === id
      ? { ...t, messages, updatedAt: Date.now(), title: text ? text.slice(0, 50) : t.title }
      : t));
  },
  remove(id: string) { save(load().filter((t) => t.id !== id)); },
};

export function useThreads() {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    load,
    () => EMPTY,
  );
}
