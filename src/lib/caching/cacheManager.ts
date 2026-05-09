/**
 * Flexible Cache Manager
 * Handles caching with support for Redis (Upstash) and memory storage
 * Implements different cache strategies (permanent, TTL, auto-refresh, etc.)
 */

import { redisClient } from './redisClient';
import { getCacheConfig, usesMemory, usesRedis, usesLocalStorage } from './cacheConfig';
import type { CacheStrategy } from './cacheConfig';

interface CacheItem<T> {
  value: T;
  timestamp: number;
  expiresAt?: number;
  strategy: CacheStrategy;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  lastUpdated: number;
}

/**
 * Main Cache Manager class
 */
class CacheManager {
  private memoryCache: Map<string, CacheItem<any>> = new Map();
  private stats: Map<string, CacheStats> = new Map();
  private updateTimers: Map<string, NodeJS.Timeout> = new Map();
  private refreshCallbacks: Map<string, () => Promise<any>> = new Map();

  constructor() {
    this.initializeStats();
    console.log('🚀 Cache Manager initialized');
    console.log('🔍 Redis available:', redisClient.isRedisAvailable());
    console.log('🔍 Redis URL configured:', !!import.meta.env.VITE_REDIS_URL);
  }

  /**
   * Initialize stats for a cache key
   */
  private initializeStats(cacheKey?: string) {
    if (cacheKey && !this.stats.has(cacheKey)) {
      this.stats.set(cacheKey, {
        hits: 0,
        misses: 0,
        size: 0,
        lastUpdated: Date.now(),
      });
    }
  }

  /**
   * Get a value from cache
   */
  async get<T>(cacheKey: string, key: string): Promise<T | null> {
    this.initializeStats(cacheKey);
    const config = getCacheConfig(cacheKey);
    const fullKey = this.buildFullKey(cacheKey, key);

    try {
      // Try memory first if configured
      if (usesMemory(config)) {
        const cached = this.memoryCache.get(fullKey);
        if (cached && !this.isExpired(cached)) {
          this.recordHit(cacheKey);
          console.log(`✅ [Cache] Memory hit - ${fullKey}`);
          return cached.value as T;
        }
      }

      // Try local storage if configured
      if (usesLocalStorage(config)) {
        const localValue = this.getFromLocalStorage<T>(fullKey);
        if (localValue !== null) {
          this.recordHit(cacheKey);
          console.log(`✅ [Cache] Local storage hit - ${fullKey}`);

          // Sync to memory cache if also configured
          if (usesMemory(config)) {
            const cachedItem = JSON.parse(localStorage.getItem(fullKey)!);
            this.memoryCache.set(fullKey, cachedItem);
          }

          return localValue;
        }
      }

      // Try Redis if configured
      if (usesRedis(config) && redisClient.isRedisAvailable()) {
        console.log(`🔍 [Cache] Trying Redis for ${fullKey}`);
        const redisValue = await redisClient.get(fullKey);
        if (redisValue) {
          try {
            const parsed = JSON.parse(redisValue);
            this.recordHit(cacheKey);
            console.log(`✅ [Cache] Redis hit - ${fullKey}`);

            // Optionally sync to memory cache
            if (usesMemory(config)) {
              this.memoryCache.set(fullKey, {
                value: parsed,
                timestamp: Date.now(),
                strategy: config.strategy,
              });
            }

            return parsed as T;
          } catch (e) {
            console.error(`❌ [Cache] Failed to parse Redis value`);
          }
        } else {
          console.log(`❌ [Cache] Redis miss - ${fullKey}`);
        }
      } else {
        console.log(`⚠️ [Cache] Redis not available or not configured for ${cacheKey} (backend: ${config.backend})`);
      }

      this.recordMiss(cacheKey);
      console.log(`❌ [Cache] Miss - ${fullKey}`);
      return null;
    } catch (error) {
      console.error(`❌ [Cache] Get error`);
      return null;
    }
  }

  /**
   * Set a value in cache
   */
  async set<T>(
    cacheKey: string,
    key: string,
    value: T,
    customTtl?: number,
  ): Promise<boolean> {
    this.initializeStats(cacheKey);
    const config = getCacheConfig(cacheKey);
    const fullKey = this.buildFullKey(cacheKey, key);

    // Validate value - don't cache null, undefined, or empty values
    if (value === null || value === undefined) {
      console.log(`⚠️ [Cache] Skipping cache for ${fullKey} - null/undefined value`);
      return false;
    }

    // Check for empty arrays, objects, or strings
    if (Array.isArray(value) && value.length === 0) {
      console.log(`⚠️ [Cache] Skipping cache for ${fullKey} - empty array`);
      return false;
    }

    if (typeof value === 'object' && value !== null && Object.keys(value).length === 0) {
      console.log(`⚠️ [Cache] Skipping cache for ${fullKey} - empty object`);
      return false;
    }

    if (typeof value === 'string' && value.trim().length === 0) {
      console.log(`⚠️ [Cache] Skipping cache for ${fullKey} - empty string`);
      return false;
    }

    try {
      const ttl = customTtl || config.ttl;
      const timestamp = Date.now();
      const expiresAt =
        config.strategy === 'permanent' ? undefined : timestamp + (ttl || 0) * 1000;

      const cacheItem: CacheItem<T> = {
        value,
        timestamp,
        expiresAt,
        strategy: config.strategy,
      };

      // Store in memory if configured
      if (usesMemory(config)) {
        this.memoryCache.set(fullKey, cacheItem);
        this.updateStats(cacheKey, this.getMemoryCacheSize());
      }

      // Store in local storage if configured
      if (usesLocalStorage(config)) {
        const success = this.setInLocalStorage(fullKey, cacheItem);
        if (!success) {
          console.log(`❌ [Cache] Failed to set local storage - ${fullKey}`);
          return false;
        }
        console.log(`✅ [Cache] Set local storage - ${fullKey}`);
      }

      // Store in Redis if configured
      if (usesRedis(config) && redisClient.isRedisAvailable()) {
        const serialized = JSON.stringify(value);
        console.log(`🔍 [Cache] Setting Redis for ${fullKey} (TTL: ${ttl}s)`);
        const success = await redisClient.set(fullKey, serialized, ttl);
        if (!success) {
          console.log(`❌ [Cache] Failed to set Redis - ${fullKey}`);
          return false;
        }
        console.log(`✅ [Cache] Set Redis - ${fullKey} (TTL: ${ttl}s)`);
      } else if (usesRedis(config)) {
        console.warn(
          `⚠️  Redis configured but unavailable for ${fullKey}, using memory only`,
        );
      }

      console.log(`✅ [Cache] Stored - ${fullKey}`);
      return true;
    } catch (error) {
      console.error(`❌ [Cache] Set error`);
      return false;
    }
  }

  /**
   * Delete a value from cache
   */
  async delete(cacheKey: string, key: string): Promise<boolean> {
    const config = getCacheConfig(cacheKey);
    const fullKey = this.buildFullKey(cacheKey, key);

    try {
      // Delete from memory
      if (usesMemory(config)) {
        this.memoryCache.delete(fullKey);
      }

      // Delete from local storage
      if (usesLocalStorage(config)) {
        this.deleteFromLocalStorage(fullKey);
      }

      // Delete from Redis
      if (usesRedis(config) && redisClient.isRedisAvailable()) {
        await redisClient.del(fullKey);
      }

      console.log(`✅ [Cache] Deleted - ${fullKey}`);
      return true;
    } catch (error) {
      console.error(`❌ [Cache] Delete error`);
      return false;
    }
  }

  /**
   * Clear all items for a cache key
   */
  async clear(cacheKey: string): Promise<boolean> {
    try {
      const pattern = `${cacheKey}:*`;

      // Clear from memory
      for (const key of this.memoryCache.keys()) {
        if (key.startsWith(`${cacheKey}:`)) {
          this.memoryCache.delete(key);
        }
      }

      // Clear from Redis
      if (redisClient.isRedisAvailable()) {
        const keys = await redisClient.keys(pattern);
        for (const key of keys) {
          await redisClient.del(key);
        }
      }

      console.log(`✅ [Cache] Cleared - ${cacheKey}`);
      return true;
    } catch (error) {
      console.error(`❌ [Cache] Clear error`);
      return false;
    }
  }

  /**
   * Set up auto-refresh for a cache key
   */
  setupAutoRefresh(
    cacheKey: string,
    key: string,
    refreshFn: () => Promise<any>,
    interval?: number,
  ): void {
    const config = getCacheConfig(cacheKey);
    if (config.strategy !== 'auto-refresh' && !interval) {
      return;
    }

    const fullKey = this.buildFullKey(cacheKey, key);
    const refreshInterval = interval || config.refreshInterval || 60 * 60 * 1000;

    // Store the refresh callback
    this.refreshCallbacks.set(fullKey, refreshFn);

    // Clear existing timer if any
    if (this.updateTimers.has(fullKey)) {
      clearInterval(this.updateTimers.get(fullKey)!);
    }

    // Set up new refresh interval
    const timer = setInterval(async () => {
      try {
        console.log(`🔄 [Cache] Auto-refreshing - ${fullKey}`);
        const freshData = await refreshFn();
        await this.set(cacheKey, key, freshData);
      } catch (error) {
        console.error(`❌ [Cache] Auto-refresh failed - ${fullKey}`);
      }
    }, refreshInterval);

    this.updateTimers.set(fullKey, timer);
    console.log(
      `⏱️  [Cache] Auto-refresh setup - ${fullKey} (interval: ${refreshInterval}ms)`,
    );
  }

  /**
   * Cancel auto-refresh for a cache key
   */
  cancelAutoRefresh(cacheKey: string, key: string): void {
    const fullKey = this.buildFullKey(cacheKey, key);
    if (this.updateTimers.has(fullKey)) {
      clearInterval(this.updateTimers.get(fullKey)!);
      this.updateTimers.delete(fullKey);
      this.refreshCallbacks.delete(fullKey);
      console.log(`⏹️  [Cache] Auto-refresh cancelled - ${fullKey}`);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(cacheKey?: string): CacheStats | Record<string, CacheStats> {
    if (cacheKey) {
      return (
        this.stats.get(cacheKey) || {
          hits: 0,
          misses: 0,
          size: 0,
          lastUpdated: Date.now(),
        }
      );
    }

    const allStats: Record<string, CacheStats> = {};
    this.stats.forEach((value, key) => {
      allStats[key] = value;
    });
    return allStats;
  }

  /**
   * Clear all caches
   */
  async clearAll(): Promise<void> {
    try {
      // Clear memory cache
      this.memoryCache.clear();

      // Clear all timers
      this.updateTimers.forEach((timer) => clearInterval(timer));
      this.updateTimers.clear();
      this.refreshCallbacks.clear();

      // Clear Redis
      if (redisClient.isRedisAvailable()) {
        await redisClient.flushAll();
      }

      console.log('✅ [Cache] All caches cleared');
    } catch (error) {
      console.error(`❌ [Cache] Clear all error`);
    }
  }

  /**
   * Update cache entries on specific events (like new episodes)
   */
  async invalidatePattern(
    cacheKey: string,
    pattern?: string,
  ): Promise<number> {
    let invalidated = 0;

    // Invalidate memory cache
    for (const key of this.memoryCache.keys()) {
      if (
        key.startsWith(`${cacheKey}:`) &&
        (!pattern || key.includes(pattern))
      ) {
        this.memoryCache.delete(key);
        invalidated++;
      }
    }

    // Invalidate Redis cache
    if (redisClient.isRedisAvailable()) {
      const searchPattern = pattern
        ? `${cacheKey}:*${pattern}*`
        : `${cacheKey}:*`;
      const keys = await redisClient.keys(searchPattern);
      for (const key of keys) {
        await redisClient.del(key);
        invalidated++;
      }
    }

    console.log(
      `🔄 [Cache] Invalidated ${invalidated} entries matching ${cacheKey}:${pattern || '*'}`,
    );
    return invalidated;
  }

  /**
   * Force refresh a cache entry
   */
  async forceRefresh(cacheKey: string, key: string): Promise<boolean> {
    const fullKey = this.buildFullKey(cacheKey, key);
    const refreshFn = this.refreshCallbacks.get(fullKey);

    if (!refreshFn) {
      console.warn(`⚠️  No refresh function registered for ${fullKey}`);
      return false;
    }

    try {
      console.log(`🔄 [Cache] Force refreshing - ${fullKey}`);
      const freshData = await refreshFn();
      await this.set(cacheKey, key, freshData);
      return true;
    } catch (error) {
      console.error(`❌ [Cache] Force refresh failed - ${fullKey}`);
      return false;
    }
  }

  /**
   * Private helper methods
   */

  private buildFullKey(cacheKey: string, key: string): string {
    return `${cacheKey}:${key}`;
  }

  private isExpired(item: CacheItem<any>): boolean {
    if (!item.expiresAt) {
      // Permanent cache, never expires
      return false;
    }
    return Date.now() > item.expiresAt;
  }

  private recordHit(cacheKey: string): void {
    const stats = this.stats.get(cacheKey);
    if (stats) {
      stats.hits++;
    }
  }

  private recordMiss(cacheKey: string): void {
    const stats = this.stats.get(cacheKey);
    if (stats) {
      stats.misses++;
    }
  }

  private updateStats(cacheKey: string, size: number): void {
    const stats = this.stats.get(cacheKey);
    if (stats) {
      stats.size = size;
      stats.lastUpdated = Date.now();
    }
  }

  private getMemoryCacheSize(): number {
    let size = 0;
    for (const item of this.memoryCache.values()) {
      size += JSON.stringify(item.value).length;
    }
    return size;
  }

  /**
   * Get a value from local storage
   */
  private getFromLocalStorage<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(key);
      if (!item) return null;

      const parsed = JSON.parse(item);
      if (this.isExpired(parsed)) {
        localStorage.removeItem(key);
        return null;
      }

      return parsed.value as T;
    } catch (error) {
      console.error('❌ [Cache] Local storage get error');
      return null;
    }
  }

  /**
   * Set a value in local storage
   */
  private setInLocalStorage<T>(key: string, item: CacheItem<T>): boolean {
    try {
      localStorage.setItem(key, JSON.stringify(item));
      return true;
    } catch (error) {
      console.error('❌ [Cache] Local storage set error');
      return false;
    }
  }

  /**
   * Delete a value from local storage
   */
  private deleteFromLocalStorage(key: string): boolean {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('❌ [Cache] Local storage delete error');
      return false;
    }
  }
}

// Export singleton instance
export const cacheManager = new CacheManager();

export type { CacheItem, CacheStats };
export { CacheManager };
