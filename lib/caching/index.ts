/**
 * Smart Caching Module
 * A three-layer (Memory → LocalStorage → Redis) intelligent cache
 * with status-aware episode strategies and Stale-While-Revalidate.
 */

// ── Core ──────────────────────────────────────────────────────────────────────
export { cacheManager, CacheManager } from './cacheManager';
export type { CacheItem, CacheStats } from './cacheManager';

// ── Redis ─────────────────────────────────────────────────────────────────────
export { redisClient, RedisClientWrapper } from './redisClient';
export type { RedisClientConfig } from './redisClient';

// ── Config ────────────────────────────────────────────────────────────────────
export {
  getCacheConfig,
  getEpisodeCacheConfig,
  usesRedis,
  usesMemory,
  usesLocalStorage,
  isPermanent,
  isSWRStrategy,
  normalizeAnimeStatus,
  CACHE_CONFIGS,
  EPISODE_CACHE_BY_STATUS,
  CACHE_VERSION,
} from './cacheConfig';

export type {
  AnimeStatus,
  CacheStrategy,
  StorageBackend,
  UpdatePolicy,
  CacheConfig,
} from './cacheConfig';

// ── Hooks ─────────────────────────────────────────────────────────────────────
export {
  // Recommended hooks
  useSmartCache,
  useAnimeInfo,
  useEpisodes,
  // Utilities
  useCacheSet,
  useCacheStats,
  useCacheInvalidate,
  // Legacy (backward-compatible)
  useCache,
} from './useCache';

// ── Invalidation ──────────────────────────────────────────────────────────────
export {
  onNewEpisode,
  onEpisodeBatchUpdate,
  onAnimeCompleted,
  onAnimeInfoUpdated,
  onScheduleUpdated,
  invalidateAnimeLists,
  clearAllCaches,
  getCacheStats,
  startPeriodicRefresh,
} from './cacheInvalidation';