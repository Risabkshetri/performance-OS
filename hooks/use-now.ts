"use client";

import { useSyncExternalStore } from "react";

// One shared 1-second ticker for every component that displays live time.
let now = 0;
const listeners = new Set<() => void>();
let timer: number | undefined;

function tick() {
  now = Date.now();
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    now = Date.now();
    timer = window.setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    }
  };
}

/** Current time in ms, updated every second; null during SSR/hydration. */
export function useNow(): number | null {
  return useSyncExternalStore(
    subscribe,
    () => (now ||= Date.now()),
    () => null,
  );
}
