/**
 * Smart Cache Configuration
 * Status-aware strategies: completed anime cached forever,
 * airing anime episodes refresh on a schedule, info always permanent.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type AnimeStatus =
  | 'COMPLETED'
  | 'ONGOING'
  | 'NOT_YET_RELEASED'
  | 'CANCELLED'
  | 'HIATUS'
  | 'UNKNOWN';

/**
 * permanent  – Never expires, write-once. For completed anime, genre lists, etc.
 * swr        – Stale-While-Revalidate: return cached instantly, refresh in bg
 * ttl        – Block until fresh if expired (for volatile data like video links)
 * volatile   – Memory-only short TTL (video sources, etc.)
 * never      – Don't cache this
 */
export type CacheStrategy = 'permanent' | 'swr' | 'ttl' | 'volatile' | 'never';
export type StorageBackend = 'memory' | 'redis' | 'local' | 'hybrid';
export type UpdatePolicy = 'immutable' | 'background-refresh' | 'on-demand' | 'swr';

export interface CacheConfig {
  strategy: CacheStrategy;
  /** Seconds until data is considered stale (triggers bg refresh in SWR mode) */
  ttl?: number;
  /** Seconds until data is absolutely refused — must re-fetch (SWR outer window) */
  hardTtl?: number;
  backend: StorageBackend;
  maxEntries?: number;
  updatePolicy: UpdatePolicy;
  /** Milliseconds between automatic background refreshes */
  refreshInterval?: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

// ── Time constants (in seconds) ───────────────────────────────────────────────

const M = 60;          // 1 minute
const H = 60 * M;      // 1 hour
const D = 24 * H;      // 1 day
const W = 7 * D;       // 1 week

// ── Cache schema version — bump to bust all stored entries ────────────────────
export const CACHE_VERSION = 2;

// ── Per-status episode strategies ─────────────────────────────────────────────
/**
 * This is the core intelligence of the caching system.
 *
 * Completed anime: episodes are immutable → cache forever, never refresh.
 * Ongoing anime:   new episodes drop weekly → SWR with 2h TTL, refresh every 2h.
 * Hiatus:          may resume → SWR with 1-day TTL.
 * Not yet released: no episodes yet → short memory-only TTL.
 * Cancelled:       like completed, never changes → permanent.
 */
export const EPISODE_CACHE_BY_STATUS: Record<AnimeStatus, CacheConfig> = {
  COMPLETED: {
    strategy: 'permanent',
    backend: 'hybrid',
    updatePolicy: 'immutable',
    priority: 'critical',
  },
  ONGOING: {
    strategy: 'swr',
    ttl: 2 * H,
    hardTtl: 12 * H,
    backend: 'hybrid',
    updatePolicy: 'background-refresh',
    refreshInterval: 2 * 60 * 60 * 1000, // 2 hours in ms
    priority: 'high',
  },
  HIATUS: {
    strategy: 'swr',
    ttl: D,
    hardTtl: 3 * D,
    backend: 'hybrid',
    updatePolicy: 'on-demand',
    priority: 'medium',
  },
  NOT_YET_RELEASED: {
    strategy: 'ttl',
    ttl: H,
    backend: 'memory',
    updatePolicy: 'on-demand',
    priority: 'low',
  },
  CANCELLED: {
    strategy: 'permanent',
    backend: 'hybrid',
    updatePolicy: 'immutable',
    priority: 'low',
  },
  UNKNOWN: {
    strategy: 'swr',
    ttl: 4 * H,
    hardTtl: 12 * H,
    backend: 'hybrid',
    updatePolicy: 'background-refresh',
    refreshInterval: 4 * 60 * 60 * 1000,
    priority: 'medium',
  },
};

// ── Named cache configs ────────────────────────────────────────────────────────

export const CACHE_CONFIGS: Record<string, CacheConfig> = {

  // ── Anime info: always permanent ───────────────────────────────────────────
  // Title, description, genres, cover — structural data that almost never changes.
  // Permanent cache = instant loads, zero server pressure.
  Info: {
    strategy: 'permanent',
    backend: 'hybrid',
    updatePolicy: 'immutable',
    priority: 'critical',
  },

  // ── Episodes: default — overridden at runtime by anime status ──────────────
  Episodes: {
    strategy: 'swr',
    ttl: 2 * H,
    hardTtl: 12 * H,
    backend: 'hybrid',
    updatePolicy: 'background-refresh',
    refreshInterval: 2 * 60 * 60 * 1000,
    priority: 'high',
  },

  // ── Live / schedule data ───────────────────────────────────────────────────
  'Recent Episodes': {
    strategy: 'swr',
    ttl: H,
    hardTtl: 4 * H,
    backend: 'hybrid',
    updatePolicy: 'background-refresh',
    refreshInterval: 60 * 60 * 1000,
    priority: 'high',
  },
  'Airing Schedule': {
    strategy: 'swr',
    ttl: H,
    hardTtl: 4 * H,
    backend: 'hybrid',
    updatePolicy: 'background-refresh',
    refreshInterval: 60 * 60 * 1000,
    priority: 'high',
  },

  // ── Trending/ranked lists ──────────────────────────────────────────────────
  Trending: {
    strategy: 'swr',
    ttl: 6 * H,
    hardTtl: 12 * H,
    backend: 'hybrid',
    updatePolicy: 'background-refresh',
    refreshInterval: 6 * 60 * 60 * 1000,
    priority: 'high',
  },
  Popular: {
    strategy: 'swr',
    ttl: 12 * H,
    hardTtl: D,
    backend: 'hybrid',
    updatePolicy: 'background-refresh',
    refreshInterval: 12 * 60 * 60 * 1000,
    priority: 'high',
  },
  TopRated: {
    strategy: 'swr',
    ttl: 12 * H,
    hardTtl: D,
    backend: 'hybrid',
    updatePolicy: 'background-refresh',
    refreshInterval: 12 * 60 * 60 * 1000,
    priority: 'high',
  },
  TopAiring: {
    strategy: 'swr',
    ttl: 6 * H,
    hardTtl: 12 * H,
    backend: 'hybrid',
    updatePolicy: 'background-refresh',
    refreshInterval: 6 * 60 * 60 * 1000,
    priority: 'high',
  },
  Upcoming: {
    strategy: 'swr',
    ttl: 12 * H,
    hardTtl: D,
    backend: 'hybrid',
    updatePolicy: 'background-refresh',
    refreshInterval: 12 * 60 * 60 * 1000,
    priority: 'medium',
  },

  // ── Search ─────────────────────────────────────────────────────────────────
  'Advanced Search': {
    strategy: 'swr',
    ttl: 6 * H,
    hardTtl: D,
    backend: 'hybrid',
    maxEntries: 100,
    updatePolicy: 'on-demand',
    priority: 'medium',
  },

  // ── Permanent metadata ─────────────────────────────────────────────────────
  Data: {
    strategy: 'permanent',
    backend: 'hybrid',
    updatePolicy: 'immutable',
    priority: 'critical',
  },
  AniListGenres: {
    strategy: 'permanent',
    backend: 'hybrid',
    updatePolicy: 'immutable',
    priority: 'low',
  },
  MangaRead: {
    strategy: 'permanent',
    backend: 'hybrid',
    updatePolicy: 'immutable',
    priority: 'medium',
  },
  SkipTimes: {
    strategy: 'permanent',
    backend: 'hybrid',
    updatePolicy: 'immutable',
    priority: 'medium',
  },

  // ── Studio ─────────────────────────────────────────────────────────────────
  Studio: {
    strategy: 'swr',
    ttl: W,
    hardTtl: 30 * D,
    backend: 'hybrid',
    updatePolicy: 'on-demand',
    priority: 'medium',
  },

  // ── Video sources: memory-only, short TTL (CDN links expire) ──────────────
  'Video Sources': {
    strategy: 'volatile',
    ttl: 2 * H,
    backend: 'memory',
    updatePolicy: 'on-demand',
    priority: 'high',
  },
  'Video Embedded Sources': {
    strategy: 'volatile',
    ttl: 4 * H,
    backend: 'memory',
    updatePolicy: 'on-demand',
    priority: 'high',
  },
};

// ── Utility functions ─────────────────────────────────────────────────────────

export function getCacheConfig(cacheKey: string): CacheConfig {
  return (
    CACHE_CONFIGS[cacheKey] ?? {
      strategy: 'swr',
      ttl: 6 * H,
      hardTtl: D,
      backend: 'hybrid',
      updatePolicy: 'on-demand',
      priority: 'medium',
    }
  );
}

export function getEpisodeCacheConfig(status: AnimeStatus): CacheConfig {
  return EPISODE_CACHE_BY_STATUS[status];
}

/**
 * Get status-aware cache config for anime info/metadata.
 * 
 * This prevents a critical bug where anime that were "Not yet aired" get
 * permanently cached, and never update even after they start airing.
 * 
 * Strategy:
 *  • NOT_YET_RELEASED  → TTL 1h (short, so we detect when it airs quickly)
 *  • ONGOING/HIATUS    → SWR 4h (moderate refresh, new episodes may drop)
 *  • COMPLETED/CANCELLED → permanent (immutable, never changes)
 *  • UNKNOWN           → SWR 6h (safe default)
 */
export function getInfoCacheConfig(status: AnimeStatus): CacheConfig {
  switch (status) {
    case 'NOT_YET_RELEASED':
      // Short TTL so we quickly detect when anime starts airing
      return {
        strategy: 'ttl',
        ttl: H,
        backend: 'hybrid',
        updatePolicy: 'on-demand',
        priority: 'high',
      };
    case 'ONGOING':
      // SWR with 4h TTL — new episodes may drop, but not as volatile as episodes
      return {
        strategy: 'swr',
        ttl: 4 * H,
        hardTtl: 12 * H,
        backend: 'hybrid',
        updatePolicy: 'background-refresh',
        refreshInterval: 4 * 60 * 60 * 1000,
        priority: 'high',
      };
    case 'HIATUS':
      // May resume eventually — moderate refresh
      return {
        strategy: 'swr',
        ttl: D,
        hardTtl: 3 * D,
        backend: 'hybrid',
        updatePolicy: 'on-demand',
        priority: 'medium',
      };
    case 'COMPLETED':
    case 'CANCELLED':
      // Immutable — permanent cache is safe
      return {
        strategy: 'permanent',
        backend: 'hybrid',
        updatePolicy: 'immutable',
        priority: 'low',
      };
    case 'UNKNOWN':
    default:
      // Safe fallback with regular SWR
      return {
        strategy: 'swr',
        ttl: 6 * H,
        hardTtl: D,
        backend: 'hybrid',
        updatePolicy: 'background-refresh',
        refreshInterval: 6 * 60 * 60 * 1000,
        priority: 'medium',
      };
  }
}

export const usesRedis = (c: CacheConfig): boolean =>
  c.backend === 'redis' || c.backend === 'hybrid';

export const usesMemory = (c: CacheConfig): boolean =>
  c.backend === 'memory' || c.backend === 'hybrid' || c.backend === 'local';

export const usesLocalStorage = (c: CacheConfig): boolean =>
  c.backend === 'local' || c.backend === 'hybrid';

export const isPermanent = (c: CacheConfig): boolean =>
  c.strategy === 'permanent';

export const isSWRStrategy = (c: CacheConfig): boolean =>
  c.strategy === 'swr';

/**
 * Normalize any status string from the API into our internal AnimeStatus type.
 * Handles AniList, Consumet, Jikan, and other common status values.
 */
export function normalizeAnimeStatus(raw?: string | null): AnimeStatus {
  if (!raw) return 'UNKNOWN';
  switch (raw.toUpperCase().trim()) {
    case 'COMPLETED':
    case 'FINISHED':
    case 'FINISHED_AIRING':
    case 'COMPLETE':
      return 'COMPLETED';
    case 'ONGOING':
    case 'RELEASING':
    case 'CURRENTLY_AIRING':
    case 'AIRING':
      return 'ONGOING';
    case 'NOT_YET_RELEASED':
    case 'NOT_YET_AIRED':
    case 'UPCOMING':
      return 'NOT_YET_RELEASED';
    case 'CANCELLED':
    case 'CANCELED':
      return 'CANCELLED';
    case 'HIATUS':
    case 'ON_HIATUS':
      return 'HIATUS';
    default:
      return 'UNKNOWN';
  }
}