import { useSyncExternalStore } from "react";

export type SidebarState = "visible" | "hidden";

const KEY = "metalfuze.sidebar";
const listeners = new Set<() => void>();
let state: SidebarState = "visible";

/**
 * Runs in the document <head> before paint so a collapsed sidebar never
 * flashes open on load.
 */
export const sidebarScript = `(function(){try{var v=localStorage.getItem(${JSON.stringify(KEY)});if(v!=="hidden"){v="visible"}document.documentElement.dataset.sidebar=v}catch(e){}})()`;

export const currentSidebar = () => state;

export function setSidebar(next: SidebarState) {
  state = next;
  try {
    document.documentElement.dataset["sidebar"] = next;
  } catch {
    /* SSR or no document — the switch still works for this visit */
  }
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* private mode — the switch still works for this visit */
  }
  listeners.forEach((listener) => listener());
}

export function useSidebar() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    currentSidebar,
    () => "visible" as SidebarState,
  );
}

/** Picks up the value the pre-paint script wrote into <html data-sidebar>. */
export function initializeSidebar() {
  const next: SidebarState =
    document.documentElement.dataset["sidebar"] === "hidden" ? "hidden" : "visible";
  if (next !== state) {
    state = next;
    listeners.forEach((listener) => listener());
  }
}
