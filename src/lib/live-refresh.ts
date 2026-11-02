import { useEffect, useRef } from "react";

type Listener = { tables: readonly string[]; refresh: () => void | Promise<unknown>; running: boolean; queued: boolean };
const listeners = new Set<Listener>();

async function run(listener: Listener) {
  if (listener.running) { listener.queued = true; return; }
  listener.running = true;
  try { await listener.refresh(); } catch { /* Existing loaders handle user-facing errors. */ }
  finally {
    listener.running = false;
    if (listener.queued && listeners.has(listener)) { listener.queued = false; void run(listener); }
  }
}

export function subscribeLiveRefresh(tables: readonly string[], refresh: Listener["refresh"]) {
  const listener: Listener = { tables, refresh, running: false, queued: false };
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function refreshLiveReaders(table?: string) {
  for (const listener of listeners) {
    if (!table || listener.tables.includes(table)) void run(listener);
  }
}

/** Refresh data only: never remount a screen or reset its form state. */
export function useLiveRefresh(tables: readonly string[], refresh: Listener["refresh"]) {
  const latest = useRef(refresh);
  latest.current = refresh;
  const key = tables.join("|");
  useEffect(() => subscribeLiveRefresh(key.split("|"), () => latest.current()), [key]);
}