/**
 * safeStorage.ts
 *
 * Safe localStorage helpers that never throw — in particular they swallow the
 * `QuotaExceededError` that would otherwise crash the app when a growing key
 * like `watched-episodes` or `read-chapters` blows past the ~5 MB per-origin
 * budget.
 *
 * Strategy:
 *   1. try the write;
 *   2. on QuotaExceededError, evict the single largest key and retry once;
 *   3. if it still fails, give up silently (the data is non-critical — the
 *      full episode history also lives in IndexedDB via WatchHistoryDB).
 */

/** Write to localStorage without ever throwing on quota errors. */
export function safeLocalStorageSet(key: string, value: string): void {
  const tryWrite = () => localStorage.setItem(key, value);
  try {
    tryWrite();
  } catch (e) {
    if (!(e instanceof DOMException && e.name === 'QuotaExceededError')) {
      console.error('[localStorage] Unexpected write error:', e);
      return;
    }
    // Evict the single largest key and retry once.
    try {
      let largest = '';
      let largestSize = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)!;
        const size = (localStorage.getItem(k) || '').length;
        if (size > largestSize) {
          largest = k;
          largestSize = size;
        }
      }
      if (largest) {
        console.warn(
          `[localStorage] Quota exceeded — evicting largest key: "${largest}" (${largestSize} chars)`,
        );
        localStorage.removeItem(largest);
      }
      tryWrite();
    } catch {
      console.warn(
        `[localStorage] Could not write "${key}" even after eviction — skipping.`,
      );
    }
  }
}

/**
 * Read and JSON.parse a localStorage key, returning `fallback` on any error or
 * missing value. Mirrors the try/parse pattern repeated throughout the app.
 */
export function safeLocalStorageGetJson<T>(
  key: string,
  fallback: T,
): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
