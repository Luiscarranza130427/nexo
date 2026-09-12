'use client';

import { useCallback, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'nexo:sidebar-collapsed';

/**
 * Tiny store over localStorage.
 *
 * `useSyncExternalStore` is the right tool here rather than an effect that
 * calls setState: localStorage *is* an external store, and this reads it
 * during render instead of triggering a second render after mount.
 */
const listeners = new Set<() => void>();

let cached: boolean | null = null;

function read(): boolean {
  if (cached === null) {
    try {
      cached = window.localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      // Storage unavailable (private browsing): expanded is a fine default.
      cached = false;
    }
  }

  return cached;
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);

  // Keeps two tabs in the same browser consistent.
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      cached = event.newValue === 'true';
      onChange();
    }
  };

  window.addEventListener('storage', onStorage);

  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onStorage);
  };
}

/** Server render has no storage; the sidebar starts expanded. */
function serverSnapshot(): boolean {
  return false;
}

export function useSidebarCollapsed() {
  const collapsed = useSyncExternalStore(subscribe, read, serverSnapshot);

  const toggle = useCallback(() => {
    cached = !read();

    try {
      window.localStorage.setItem(STORAGE_KEY, String(cached));
    } catch {
      // The preference simply will not persist.
    }

    for (const listener of listeners) {
      listener();
    }
  }, []);

  return { collapsed, toggle };
}
