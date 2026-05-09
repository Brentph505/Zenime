/**
 * React hooks for the smart cache system.
 *
 * Highlights:
 *  • useAnimeInfo  — permanent-cached anime metadata
 *  • useEpisodes   — status-aware episode hook (completed = permanent, airing = SWR)
 *  • useSmartCache — generic SWR hook with stale-while-revalidate
 *  • useCacheSet / useCacheStats / useCacheInvalidate — helpers
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { cacheManager } from './cacheManager';
import { normalizeAnimeStatus } from './cacheConfig';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CacheHookOptions<T> {
  enabled?: boolean;
  /** Called once when data is first loaded from cache (instant) */
  onCacheHit?: (data: T) => void;
  /** Called when a network fetch is needed */
  onFetch?: () => void;
  /** Called after a background SWR refresh completes */
  onRefreshed?: (data: T) => void;
}

interface CacheHookResult<T> {
  data: T | null;
  loading: boolean;
  /** true while a background SWR refresh is in flight */
  refreshing: boolean;
  /** true if the returned data is stale (past soft TTL) */
  isStale: boolean;
  error: Error | null;
  /** Force an immediate re-fetch and cache update */
  refetch: () => Promise<void>;
  /** Remove the cached entry and clear local state */
  invalidate: () => Promise<void>;
}

// ── Generic SWR hook ─────────────────────────────────────────────────────────

/**
 * useSmartCache — SWR-aware cache hook.
 *
 * On mount:
 *  1. Returns cached data immediately (even if stale) → no loading flash.
 *  2. If stale, fires a background refresh → `refreshing` becomes true,
 *     then `data` updates when the fresh response arrives.
 *  3. If no cache, fetches normally → `loading` is true.
 */
export function useSmartCache<T>(
  cacheKey: string,
  key: string,
  fetchFn: () => Promise<T>,
  options: CacheHookOptions<T> = {},
): CacheHookResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mounted = useRef(true);
  const { enabled = true, onCacheHit, onFetch, onRefreshed } = options;

  const load = useCallback(async () => {
    if (!enabled) { setLoading(false); return; }

    try {
      const { data: cached, isStale: stale } = await cacheManager.fetchWithCache(
        cacheKey, key, fetchFn,
      );

      if (!mounted.current) return;

      if (cached !== null) {
        setData(cached as T);
        setIsStale(stale);
        setLoading(false);

        if (!stale) {
          onCacheHit?.(cached as T);
        } else {
          // Stale — fetchWithCache already spawned a background refresh.
          // Poll the cache until freshness is restored.
          setRefreshing(true);
          pollUntilFresh(cacheKey, key, fetchFn).then((fresh) => {
            if (!mounted.current) return;
            if (fresh !== null) {
              setData(fresh as T);
              setIsStale(false);
              onRefreshed?.(fresh as T);
            }
            setRefreshing(false);
          });
        }
      } else {
        // Real miss — we waited for a network fetch
        onFetch?.();
        if (cached !== null) setData(cached as T);
        setLoading(false);
      }
    } catch (err) {
      if (!mounted.current) return;
      setError(err instanceof Error ? err : new Error(String(err)));
      setLoading(false);
    }
  }, [cacheKey, key, enabled]);

  useEffect(() => {
    mounted.current = true;
    setLoading(true);
    setError(null);
    load();
    return () => { mounted.current = false; };
  }, [load]);

  const refetch = useCallback(async () => {
    if (!mounted.current) return;
    setRefreshing(true);
    try {
      const fresh = await fetchFn();
      await cacheManager.set(cacheKey, key, fresh);
      if (mounted.current && fresh !== null) {
        setData(fresh as T);
        setIsStale(false);
      }
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      if (mounted.current) setRefreshing(false);
    }
  }, [cacheKey, key, fetchFn]);

  const invalidate = useCallback(async () => {
    await cacheManager.delete(cacheKey, key);
    if (mounted.current) {
      setData(null);
      setIsStale(false);
    }
  }, [cacheKey, key]);

  return { data, loading, refreshing, isStale, error, refetch, invalidate };
}

// ── Anime Info hook ───────────────────────────────────────────────────────────

/**
 * useAnimeInfo — anime metadata, always permanently cached.
 * First load fetches from network, every subsequent visit is instant.
 */
export function useAnimeInfo<T>(
  animeId: string,
  fetchFn: () => Promise<T>,
  options?: CacheHookOptions<T>,
): CacheHookResult<T> {
  return useSmartCache('Info', animeId, fetchFn, options);
}

// ── Episodes hook ────────────────────────────────────────────────────────────

/**
 * useEpisodes — status-aware episode hook.
 *
 * Automatically determines caching strategy from the anime's status:
 *  - COMPLETED → permanent, never re-fetches
 *  - ONGOING   → SWR 2h, background-refreshes on schedule
 *  - HIATUS    → SWR 1 day
 *  - others    → sensible fallbacks
 *
 * Pass `animeInfo` when available so we don't need an extra cache lookup.
 */
export function useEpisodes<T>(
  animeId: string,
  fetchFn: () => Promise<T>,
  animeInfo?: { status?: string; totalEpisodes?: number },
  options: CacheHookOptions<T> = {},
): CacheHookResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mounted = useRef(true);
  const { enabled = true, onCacheHit, onRefreshed } = options;
  const status = normalizeAnimeStatus(animeInfo?.status);
  const isCompleted = status === 'COMPLETED' || status === 'CANCELLED';

  const load = useCallback(async () => {
    if (!enabled) { setLoading(false); return; }

    try {
      const { data: cached, isStale: stale } = await cacheManager.fetchEpisodesWithCache(
        animeId, fetchFn, animeInfo,
      );

      if (!mounted.current) return;
      setData(cached as T);
      setIsStale(stale);
      setLoading(false);

      if (!stale) {
        onCacheHit?.(cached as T);
      } else if (!isCompleted) {
        // Background refresh is already spawned; poll for the update
        setRefreshing(true);
        pollEpisodesFresh(animeId, fetchFn, animeInfo).then((fresh) => {
          if (!mounted.current) return;
          if (fresh !== null) {
            setData(fresh as T);
            setIsStale(false);
            onRefreshed?.(fresh as T);
          }
          setRefreshing(false);
        });
      }
    } catch (err) {
      if (!mounted.current) return;
      setError(err instanceof Error ? err : new Error(String(err)));
      setLoading(false);
    }
  }, [animeId, enabled, animeInfo?.status]);

  useEffect(() => {
    mounted.current = true;
    setLoading(true);
    setError(null);
    load();
    return () => { mounted.current = false; };
  }, [load]);

  const refetch = useCallback(async () => {
    if (isCompleted) return; // Completed episodes never change — skip silently
    if (!mounted.current) return;
    setRefreshing(true);
    try {
      const fresh = await fetchFn();
      await cacheManager.setEpisodes(animeId, fresh, animeInfo);
      if (mounted.current) { setData(fresh); setIsStale(false); onRefreshed?.(fresh); }
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      if (mounted.current) setRefreshing(false);
    }
  }, [animeId, isCompleted, fetchFn]);

  const invalidate = useCallback(async () => {
    if (isCompleted) return;
    await cacheManager.delete('Episodes', animeId);
    if (mounted.current) { setData(null); setIsStale(false); }
  }, [animeId, isCompleted]);

  return { data, loading, refreshing, isStale, error, refetch, invalidate };
}

// ── Legacy useCache hook (backward-compatible) ────────────────────────────────

interface LegacyUseCacheOptions {
  enabled?: boolean;
  onHit?: () => void;
  onMiss?: () => void;
  shouldAutoRefresh?: boolean;
}

/**
 * @deprecated Prefer useSmartCache, useAnimeInfo, or useEpisodes.
 * Kept for backward compatibility.
 */
export function useCache<T>(
  cacheKey: string,
  key: string,
  fetchFn: () => Promise<T>,
  options: LegacyUseCacheOptions = {},
): {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  invalidate: () => Promise<void>;
} {
  const { enabled = true, onHit, onMiss, shouldAutoRefresh = false } = options;

  const result = useSmartCache(cacheKey, key, fetchFn, {
    enabled,
    onCacheHit: onHit,
    onFetch: onMiss,
  });

  // Set up auto-refresh if requested
  useEffect(() => {
    if (!shouldAutoRefresh || !enabled) return;
    cacheManager.setupAutoRefresh(cacheKey, key, fetchFn);
    return () => cacheManager.cancelAutoRefresh(cacheKey, key);
  }, [cacheKey, key, shouldAutoRefresh, enabled]);

  return {
    data: result.data,
    loading: result.loading,
    error: result.error,
    refetch: result.refetch,
    invalidate: result.invalidate,
  };
}

// ── Utility hooks ─────────────────────────────────────────────────────────────

/** Manually store a value in cache */
export function useCacheSet<T>(cacheKey: string, key: string) {
  return useCallback(
    (data: T, overrides?: Record<string, unknown>) =>
      cacheManager.set(cacheKey, key, data, overrides),
    [cacheKey, key],
  );
}

/** Live-updating cache statistics (refreshes every 5 seconds) */
export function useCacheStats(cacheKey?: string) {
  const [stats, setStats] = useState(() => cacheManager.getStats(cacheKey));

  useEffect(() => {
    const interval = setInterval(
      () => setStats(cacheManager.getStats(cacheKey)),
      5_000,
    );
    return () => clearInterval(interval);
  }, [cacheKey]);

  return stats;
}

/** Returns a function to invalidate cache entries by pattern */
export function useCacheInvalidate() {
  return useCallback(
    (cacheKey: string, pattern?: string) =>
      cacheManager.invalidatePattern(cacheKey, pattern),
    [],
  );
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Poll the cache every 500ms until it has a fresh entry (max 30s).
 * Used after a background SWR refresh is spawned.
 */
async function pollUntilFresh<T>(
  cacheKey: string,
  key: string,
  _fetchFn: () => Promise<T>,
  maxWaitMs = 30_000,
): Promise<T | null> {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    await sleep(600);
    const isStale = await cacheManager.checkIsStale(cacheKey, key);
    if (!isStale) {
      return cacheManager.get<T>(cacheKey, key);
    }
  }
  return null;
}

async function pollEpisodesFresh<T>(
  animeId: string,
  _fetchFn: () => Promise<T>,
  _animeInfo?: { status?: string; totalEpisodes?: number },
  maxWaitMs = 30_000,
): Promise<T | null> {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    await sleep(600);
    const isStale = await cacheManager.checkIsStale('Episodes', animeId);
    if (!isStale) {
      return cacheManager.getEpisodes<T>(animeId);
    }
  }
  return null;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));