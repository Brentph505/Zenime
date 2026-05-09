/**
 * Cache Configuration
 * Defines cache strategies for different data types with TTL, storage backend, and update policies
 */

export type CacheStrategy = 'permanent' | 'ttl' | 'short' | 'realtime' | 'auto-refresh';
export type StorageBackend = 'memory' | 'redis' | 'hybrid' | 'local';

export interface CacheConfig {
  strategy: CacheStrategy;
  ttl?: number; // Time to live in seconds
  backend: StorageBackend;
  maxSize?: number; // For memory-based caches
  updatePolicy?: 'on-demand' | 'periodic' | 'event-based';
  refreshInterval?: number; // For periodic updates in milliseconds
}

/**
 * Default cache configurations for different data types
 */
export const CACHE_CONFIGS: Record<string, CacheConfig> = {
  // Info pages (permanent, never expire, use local storage for persistence)
  'Info': {
    strategy: 'permanent',
    backend: 'hybrid',
    updatePolicy: 'on-demand',
  },

  // Episode data (persistent with periodic refresh)
  'Episodes': {
    strategy: 'ttl',
    ttl: 7 * 24 * 60 * 60, // 7 days
    backend: 'hybrid',
    updatePolicy: 'event-based',
  },

  // Recent episodes (auto-refresh, updates frequently)
  'Recent Episodes': {
    strategy: 'auto-refresh',
    ttl: 6 * 60 * 60, // 6 hours
    backend: 'hybrid',
    updatePolicy: 'periodic',
    refreshInterval: 2 * 60 * 60 * 1000, // Refresh every 2 hours
  },

  // Airing schedule (auto-refresh, updates regularly)
  'Airing Schedule': {
    strategy: 'auto-refresh',
    ttl: 12 * 60 * 60, // 12 hours
    backend: 'hybrid',
    updatePolicy: 'event-based',
    refreshInterval: 60 * 60 * 1000, // Refresh every hour
  },

  // Search results (moderate TTL)
  'Advanced Search': {
    strategy: 'ttl',
    ttl: 24 * 60 * 60, // 24 hours
    backend: 'hybrid',
    maxSize: 50,
    updatePolicy: 'on-demand',
  },

  // Anime data (persistent with occasional updates)
  'Data': {
    strategy: 'ttl',
    ttl: 30 * 24 * 60 * 60, // 30 days
    backend: 'hybrid',
    updatePolicy: 'event-based',
  },

  // Video sources (short TTL, changes frequently)
  'Video Embedded Sources': {
    strategy: 'ttl',
    ttl: 8 * 60 * 60, // 8 hours
    backend: 'memory',
    updatePolicy: 'on-demand',
  },

  // Video sources (short TTL)
  'Video Sources': {
    strategy: 'ttl',
    ttl: 4 * 60 * 60, // 4 hours
    backend: 'memory',
    updatePolicy: 'on-demand',
  },

  // Manga data (permanent, rarely changes)
  'MangaRead': {
    strategy: 'permanent',
    backend: 'hybrid',
    updatePolicy: 'on-demand',
  },

  // AniList genres (permanent, updated once)
  'AniListGenres': {
    strategy: 'permanent',
    backend: 'hybrid',
    updatePolicy: 'on-demand',
  },

  // Studio data (persistent)
  'Studio': {
    strategy: 'ttl',
    ttl: 30 * 24 * 60 * 60, // 30 days
    backend: 'hybrid',
    updatePolicy: 'on-demand',
  },

  // Trending/Popular anime (auto-refresh)
  'TopRated': {
    strategy: 'auto-refresh',
    ttl: 24 * 60 * 60, // 24 hours
    backend: 'hybrid',
    updatePolicy: 'periodic',
    refreshInterval: 12 * 60 * 60 * 1000,
  },

  'Trending': {
    strategy: 'auto-refresh',
    ttl: 12 * 60 * 60, // 12 hours
    backend: 'hybrid',
    updatePolicy: 'periodic',
    refreshInterval: 6 * 60 * 60 * 1000,
  },

  'Popular': {
    strategy: 'auto-refresh',
    ttl: 24 * 60 * 60, // 24 hours
    backend: 'hybrid',
    updatePolicy: 'periodic',
    refreshInterval: 12 * 60 * 60 * 1000,
  },

  'TopAiring': {
    strategy: 'auto-refresh',
    ttl: 12 * 60 * 60, // 12 hours
    backend: 'hybrid',
    updatePolicy: 'periodic',
    refreshInterval: 6 * 60 * 60 * 1000,
  },

  'Upcoming': {
    strategy: 'auto-refresh',
    ttl: 24 * 60 * 60, // 24 hours
    backend: 'hybrid',
    updatePolicy: 'periodic',
    refreshInterval: 12 * 60 * 60 * 1000,
  },

  // Skip times (short TTL, doesn't change often)
  'SkipTimes': {
    strategy: 'ttl',
    ttl: 7 * 24 * 60 * 60, // 7 days
    backend: 'memory',
    updatePolicy: 'on-demand',
  },
};

/**
 * Get cache config for a given cache key
 */
export function getCacheConfig(cacheKey: string): CacheConfig {
  return CACHE_CONFIGS[cacheKey] || {
    strategy: 'ttl',
    ttl: 24 * 60 * 60,
    backend: 'hybrid',
    updatePolicy: 'on-demand',
  };
}

/**
 * Check if a cache config uses Redis
 */
export function usesRedis(config: CacheConfig): boolean {
  return config.backend === 'redis' || config.backend === 'hybrid';
}

/**
 * Check if a cache config uses memory
 */
export function usesMemory(config: CacheConfig): boolean {
  return config.backend === 'memory' || config.backend === 'hybrid' || config.backend === 'local';
}

/**
 * Check if a cache config uses local storage
 */
export function usesLocalStorage(config: CacheConfig): boolean {
  return config.backend === 'local' || config.backend === 'hybrid';
}
