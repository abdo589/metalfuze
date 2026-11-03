import { useSyncExternalStore } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// UI identity only. Database RLS and authenticated server functions still verify access.
let session: Session | null | undefined;
const listeners = new Set<() => void>();
let stop: (() => void) | undefined;

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!stop) {
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      session = next;
      for (const notify of listeners) notify();
    });
    stop = () => data.subscription.unsubscribe();
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      stop?.();
      stop = undefined;
      session = undefined;
    }
  };
}

/** One SDK auth subscription, including INITIAL_SESSION, for all UI readers. */
export function useAuthSession() {
  return useSyncExternalStore(subscribe, () => session, () => undefined);
}