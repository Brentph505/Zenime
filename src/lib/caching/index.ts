/**
 * Caching Module Exports
 */

export { cacheManager, CacheManager } from './cacheManager';
export type { CacheItem, CacheStats } from './cacheManager';

export { redisClient, RedisClientWrapper } from './redisClient';
export type { RedisClientConfig } from './redisClient';

export {
  getCacheConfig,
  usesRedis,
  usesMemory,
  CACHE_CONFIGS,
} from './cacheConfig';
export type { CacheStrategy, StorageBackend, CacheConfig } from './cacheConfig';

export { useCache, useCacheSet, useCacheStats, useCacheInvalidate } from './useCache';

export * from './cacheInvalidation';
