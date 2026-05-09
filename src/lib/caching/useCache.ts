/**
 * useCache Hook
 * React hook for using the flexible cache system in components
 */

import { useEffect, useRef, useState } from 'react';
import { cacheManager } from './cacheManager';

interface UseCacheOptions {
  enabled?: boolean;
  onHit?: () => void;
  onMiss?: () => void;
  shouldAutoRefresh?: boolean;
}

/**
 * Hook to get cached data
 */
export function useCache<T>(
  cacheKey: string,
  key: string,
  fetchFn: () => Promise<T>,
  options: UseCacheOptions = {},
): {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  invalidate: () => Promise<void>;
} {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const isMountedRef = useRef(true);

  const {
    enabled = true,
    onHit,
    onMiss,
    shouldAutoRefresh = false,
  } = options;

  const fetchData = async () => {
    if (!enabled) return;

    try {
      setLoading(true);
      setError(null);

      // Try to get from cache
      const cached = await cacheManager.get<T>(cacheKey, key);

      if (cached) {
        if (isMountedRef.current) {
          setData(cached);
          setLoading(false);
        }
        onHit?.();
        return;
      }

      onMiss?.();

      // Fetch fresh data
      const freshData = await fetchFn();

      // Store in cache
      await cacheManager.set(cacheKey, key, freshData);

      if (isMountedRef.current) {
        setData(freshData);
        setLoading(false);
      }

      // Set up auto-refresh if needed
      if (shouldAutoRefresh) {
        cacheManager.setupAutoRefresh(cacheKey, key, fetchFn);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchData();

    return () => {
      isMountedRef.current = false;
      if (shouldAutoRefresh) {
        cacheManager.cancelAutoRefresh(cacheKey, key);
      }
    };
  }, [cacheKey, key, enabled]);

  const refetch = async () => {
    await fetchData();
  };

  const invalidate = async () => {
    await cacheManager.delete(cacheKey, key);
    setData(null);
  };

  return { data, loading, error, refetch, invalidate };
}

/**
 * Hook to manually cache data
 */
export function useCacheSet<T>(
  cacheKey: string,
  key: string,
): (data: T, ttl?: number) => Promise<void> {
  return async (data: T, ttl?: number) => {
    await cacheManager.set(cacheKey, key, data, ttl);
  };
}

/**
 * Hook to get cache statistics
 */
export function useCacheStats(cacheKey?: string) {
  const [stats, setStats] = useState(() =>
    cacheManager.getStats(cacheKey),
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(cacheManager.getStats(cacheKey));
    }, 5000);

    return () => clearInterval(interval);
  }, [cacheKey]);

  return stats;
}

/**
 * Hook to invalidate cache by pattern
 */
export function useCacheInvalidate() {
  return async (cacheKey: string, pattern?: string) => {
    return cacheManager.invalidatePattern(cacheKey, pattern);
  };
}
