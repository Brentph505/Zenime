/**
 * Smart Cache Manager
 *
 * Key features:
 *  • Status-aware episode caching — completed = permanent, airing = SWR 2h
 *  • Stale-While-Revalidate (SWR) — return stale data instantly, refresh in bg
 *  • Request deduplication — concurrent calls for the same key share one fetch
 *  • Three-layer storage: Memory → LocalStorage → Redis (with proper sync)
 *  • LRU eviction for LocalStorage when quota is exceeded
 *  • Cache versioning — bump CACHE_VERSION in cacheConfig to bust all entries
 *  • Background refresh scheduler per key
 *  • Auto-cleanup of expired LocalStorage entries on startup & hourly
 */

import { redisClient } from './redisClient';
import {
  getCacheConfig,
  getEpisodeCacheConfig,
  usesMemory,
  usesRedis,
  usesLocalStorage,
  isSWRStrategy,
  normalizeAnimeStatus,
  CACHE_VERSION,
  type CacheConfig,
  type AnimeStatus,
} from './cacheConfig';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CacheItem<T> {
  value: T;
  createdAt: number;
  /** null = permanent (never refuse to serve) */
  expiresAt: number | null;
  /** null = no SWR; otherwise the point at which bg refresh should trigger */
  staleAt: number | null;
  strategy: string;
  version: number;
  // Stored on episode entries to detect new episodes for airing anime
  animeStatus?: AnimeStatus;
  episodeCount?: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  staleHits: number;
  backgroundRefreshes: number;
  errors: number;
  sizeBytes: number;
  lastUpdated: number;
}

// ── Cache Manager ─────────────────────────────────────────────────────────────

class CacheManager {
  /** L1: in-memory map — cleared on page reload */
  private mem = new Map<string, CacheItem<unknown>>();
  private stats = new Map<string, CacheStats>();

  /** Keys of in-flight fetch promises — prevents duplicate network calls */
  private pending = new Map<string, Promise<unknown>>();

  /** Background refresh timers per full cache key */
  private refreshTimers = new Map<string, ReturnType<typeof setInterval>>();
  private refreshFns = new Map<string, () => Promise<unknown>>();

  constructor() {
    console.log(`🚀 [CacheManager] v${CACHE_VERSION} — Redis: ${redisClient.isRedisAvailable() ? 'connected' : 'offline (memory-only)'}`);
    this.runStartupCleanup();
    this.scheduleHourlyCleanup();
  }

  // ── GET ───────────────────────────────────────────────────────────────────

  /**
   * Get a cached value using the named cache key's default config.
   * SWR: returns stale data immediately and triggers a background refresh
   * via the `isStale` flag — the caller's hook handles the refresh.
   */
  async get<T>(cacheKey: string, key: string): Promise<T | null> {
    return this.getWithConfig<T>(cacheKey, key, getCacheConfig(cacheKey));
  }

  /**
   * Get episodes with automatic status-aware config selection.
   * Reads the anime's `Info` cache to determine COMPLETED vs ONGOING, etc.
   */
  async getEpisodes<T>(animeId: string): Promise<T | null> {
    const info = await this.get<{ status?: string }>('Info', animeId);
    const status = normalizeAnimeStatus(info?.status);
    const config = status !== 'UNKNOWN'
      ? getEpisodeCacheConfig(status)
      : getCacheConfig('Episodes');
    return this.getWithConfig<T>('Episodes', animeId, config);
  }

  /**
   * Low-level get that accepts an explicit config.
   */
  async getWithConfig<T>(
    cacheKey: string,
    key: string,
    config: CacheConfig,
  ): Promise<T | null> {
    this.ensureStats(cacheKey);
    const full = this.buildKey(cacheKey, key);

    try {
      // ── L1: memory ───────────────────────────────────────────────────────
      const memEntry = this.mem.get(full) as CacheItem<T> | undefined;
      if (memEntry) {
        if (!this.isHardExpired(memEntry)) {
          this.recordHit(cacheKey, 'memory', this.isSoftExpired(memEntry));
          return memEntry.value;
        }
        this.mem.delete(full);
      }

      // ── L2: localStorage ─────────────────────────────────────────────────
      if (usesLocalStorage(config)) {
        const lsEntry = this.lsRead<T>(full);
        if (lsEntry) {
          if (!this.isHardExpired(lsEntry)) {
            this.recordHit(cacheKey, 'local', this.isSoftExpired(lsEntry));
            // Promote to L1
            this.mem.set(full, lsEntry);
            return lsEntry.value;
          }
          localStorage.removeItem(full);
        }
      }

      // ── L3: Redis ────────────────────────────────────────────────────────
      if (usesRedis(config) && redisClient.isRedisAvailable()) {
        const raw = await redisClient.get(full);
        if (raw) {
          try {
            const entry = JSON.parse(raw) as CacheItem<T>;
            if (entry.version !== CACHE_VERSION) {
              // Stale schema version — treat as miss, Redis entry will expire naturally
            } else if (!this.isHardExpired(entry)) {
              this.recordHit(cacheKey, 'redis', this.isSoftExpired(entry));
              // Promote to L1 + L2
              this.mem.set(full, entry);
              if (usesLocalStorage(config)) this.lsWrite(full, entry);
              return entry.value;
            }
          } catch {
            // Corrupt entry — ignore
          }
        }
      }

      this.recordMiss(cacheKey);
      return null;
    } catch (err) {
      this.recordError(cacheKey);
      console.error(`❌ [Cache] get(${full}):`, err);
      return null;
    }
  }

  /**
   * Returns true if the cached value exists but is past its soft TTL
   * (staleAt) — meaning a background refresh should fire.
   */
  async checkIsStale(cacheKey: string, key: string): Promise<boolean> {
    const full = this.buildKey(cacheKey, key);
    const entry = this.mem.get(full) ?? this.lsRead<unknown>(full);
    return entry ? this.isSoftExpired(entry) && !this.isHardExpired(entry) : false;
  }

  // ── SET ───────────────────────────────────────────────────────────────────

  /**
   * Store a value using the named cache key's default config.
   */
  async set<T>(
    cacheKey: string,
    key: string,
    value: T,
    overrides?: Partial<CacheConfig>,
  ): Promise<boolean> {
    if (!this.isValidValue(value)) {
      console.log(`⚠️ [Cache] skip empty value for ${this.buildKey(cacheKey, key)}`);
      return false;
    }
    const config = { ...getCacheConfig(cacheKey), ...overrides };
    return this.setWithConfig(cacheKey, key, value, config);
  }

  /**
   * Smart episode set — detects anime status from the data/animeInfo
   * and applies the correct permanent/SWR strategy automatically.
   */
  async setEpisodes<T>(
    animeId: string,
    episodes: T,
    animeInfo?: { status?: string; totalEpisodes?: number },
  ): Promise<boolean> {
    if (!this.isValidValue(episodes)) return false;
    const status = normalizeAnimeStatus(animeInfo?.status);
    const config = getEpisodeCacheConfig(status);
    console.log(`📼 [Cache] setEpisodes(${animeId}) → status=${status}, strategy=${config.strategy}`);
    return this.setWithConfig('Episodes', animeId, episodes, config, {
      animeStatus: status,
      episodeCount: animeInfo?.totalEpisodes,
    });
  }

  /**
   * Low-level set with explicit config.
   */
  async setWithConfig<T>(
    cacheKey: string,
    key: string,
    value: T,
    config: CacheConfig,
    meta?: { animeStatus?: AnimeStatus; episodeCount?: number },
  ): Promise<boolean> {
    if (!this.isValidValue(value)) return false;
    this.ensureStats(cacheKey);
    const full = this.buildKey(cacheKey, key);
    const now = Date.now();
    const permanent = config.strategy === 'permanent';

    const item: CacheItem<T> = {
      value,
      createdAt: now,
      expiresAt: permanent ? null : now + (config.hardTtl ?? config.ttl ?? 86_400) * 1_000,
      staleAt:   (isSWRStrategy(config) || config.strategy === 'ttl') && config.ttl
                   ? now + config.ttl * 1_000
                   : null,
      strategy: config.strategy,
      version: CACHE_VERSION,
      ...meta,
    };

    try {
      // L1
      if (usesMemory(config)) this.mem.set(full, item);

      // L2
      if (usesLocalStorage(config)) this.lsWrite(full, item);

      // L3
      if (usesRedis(config) && redisClient.isRedisAvailable()) {
        const redisTtl = permanent ? undefined : (config.hardTtl ?? config.ttl);
        await redisClient.set(full, JSON.stringify(item), redisTtl);
      }

      this.updateSizeStats(cacheKey);
      return true;
    } catch (err) {
      this.recordError(cacheKey);
      console.error(`❌ [Cache] set(${full}):`, err);
      return false;
    }
  }

  // ── FETCH WITH CACHE ──────────────────────────────────────────────────────

  /**
   * Fetch-with-cache: the recommended public API for data fetching.
   *
   * 1. Return cached data immediately (even if stale in SWR mode).
   * 2. If stale, trigger a background refresh — caller's UI updates via refetch.
   * 3. If cache miss, deduplicate concurrent fetches and await the single request.
   */
  async fetchWithCache<T>(
    cacheKey: string,
    key: string,
    fetchFn: () => Promise<T>,
    overrides?: Partial<CacheConfig>,
  ): Promise<{ data: T; isStale: boolean }> {
    const config = { ...getCacheConfig(cacheKey), ...overrides };
    const full = this.buildKey(cacheKey, key);

    const cached = await this.getWithConfig<T>(cacheKey, key, config);
    if (cached !== null) {
      const isStale = await this.checkIsStale(cacheKey, key);
      if (isStale) {
        // Non-blocking background refresh
        this.spawnBackgroundRefresh(cacheKey, key, fetchFn, config);
      }
      return { data: cached, isStale };
    }

    // Deduplicate concurrent fetches
    if (this.pending.has(full)) {
      const data = (await this.pending.get(full)) as T;
      return { data, isStale: false };
    }

    const promise = fetchFn()
      .then(async (data) => {
        await this.setWithConfig(cacheKey, key, data, config);
        return data;
      })
      .finally(() => this.pending.delete(full));

    this.pending.set(full, promise as Promise<unknown>);
    const data = await promise;
    return { data, isStale: false };
  }

  /**
   * Smart episode fetch — deduplicates + picks strategy from anime status.
   */
  async fetchEpisodesWithCache<T>(
    animeId: string,
    fetchFn: () => Promise<T>,
    animeInfo?: { status?: string; totalEpisodes?: number },
  ): Promise<{ data: T; isStale: boolean }> {
    const full = this.buildKey('Episodes', animeId);

    const cached = await this.getEpisodes<T>(animeId);
    if (cached !== null) {
      const isStale = await this.checkIsStale('Episodes', animeId);
      const entry = this.mem.get(full);
      // Only background-refresh airing/unknown anime (not completed/cancelled)
      if (isStale && entry?.animeStatus !== 'COMPLETED' && entry?.animeStatus !== 'CANCELLED') {
        this.spawnEpisodeBackgroundRefresh(animeId, fetchFn, animeInfo);
      }
      return { data: cached, isStale };
    }

    if (this.pending.has(full)) {
      const data = (await this.pending.get(full)) as T;
      return { data, isStale: false };
    }

    const promise = fetchFn()
      .then(async (data) => {
        await this.setEpisodes(animeId, data, animeInfo ?? (data as unknown as { status?: string; totalEpisodes?: number }));
        return data;
      })
      .finally(() => this.pending.delete(full));

    this.pending.set(full, promise as Promise<unknown>);
    const data = await promise;
    return { data, isStale: false };
  }

  // ── DELETE / INVALIDATE ───────────────────────────────────────────────────

  async delete(cacheKey: string, key: string): Promise<boolean> {
    const config = getCacheConfig(cacheKey);
    const full = this.buildKey(cacheKey, key);

    this.mem.delete(full);
    if (usesLocalStorage(config)) localStorage.removeItem(full);
    if (usesRedis(config) && redisClient.isRedisAvailable()) {
      await redisClient.del(full);
    }
    return true;
  }

  async invalidatePattern(cacheKey: string, pattern?: string): Promise<number> {
    let count = 0;
    const prefix = `${cacheKey}:`;

    // L1
    for (const k of [...this.mem.keys()]) {
      if (k.startsWith(prefix) && (!pattern || k.includes(pattern))) {
        this.mem.delete(k);
        count++;
      }
    }

    // L2
    const lsKeysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix) && (!pattern || k.includes(pattern))) {
        lsKeysToRemove.push(k);
      }
    }
    lsKeysToRemove.forEach((k) => { localStorage.removeItem(k); count++; });

    // L3
    if (redisClient.isRedisAvailable()) {
      const pat = pattern ? `${cacheKey}:*${pattern}*` : `${cacheKey}:*`;
      const keys = await redisClient.keys(pat);
      if (keys.length) await redisClient.delMany(keys);
      count += keys.length;
    }

    console.log(`🔄 [Cache] invalidated ${count} entries matching ${cacheKey}:${pattern ?? '*'}`);
    return count;
  }

  async clear(cacheKey: string): Promise<void> {
    await this.invalidatePattern(cacheKey);
  }

  async clearAll(): Promise<void> {
    this.mem.clear();
    this.refreshTimers.forEach(clearInterval);
    this.refreshTimers.clear();
    this.refreshFns.clear();

    // Remove all LS keys (only our prefixed ones aren't guaranteed, so clear all)
    const allLsKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) allLsKeys.push(k);
    }
    allLsKeys.forEach((k) => localStorage.removeItem(k));

    if (redisClient.isRedisAvailable()) await redisClient.flushAll();
    console.log('🧹 [Cache] All caches cleared');
  }

  // ── AUTO-REFRESH ──────────────────────────────────────────────────────────

  setupAutoRefresh<T>(
    cacheKey: string,
    key: string,
    fetchFn: () => Promise<T>,
    intervalMs?: number,
  ): void {
    const config = getCacheConfig(cacheKey);
    const ms = intervalMs ?? config.refreshInterval;
    if (!ms) return;

    const full = this.buildKey(cacheKey, key);
    this.cancelAutoRefresh(cacheKey, key);
    this.refreshFns.set(full, fetchFn as () => Promise<unknown>);

    const timer = setInterval(async () => {
      try {
        const data = await fetchFn();
        await this.set(cacheKey, key, data);
        console.log(`⏰ [Cache] Auto-refreshed ${full}`);
      } catch (err) {
        console.error(`❌ [Cache] Auto-refresh failed for ${full}:`, err);
      }
    }, ms);

    this.refreshTimers.set(full, timer);
  }

  cancelAutoRefresh(cacheKey: string, key: string): void {
    const full = this.buildKey(cacheKey, key);
    const timer = this.refreshTimers.get(full);
    if (timer) {
      clearInterval(timer);
      this.refreshTimers.delete(full);
      this.refreshFns.delete(full);
    }
  }

  // ── STATS ─────────────────────────────────────────────────────────────────

  getStats(cacheKey?: string): CacheStats | Record<string, CacheStats> {
    if (cacheKey) return this.stats.get(cacheKey) ?? this.emptyStats();
    const out: Record<string, CacheStats> = {};
    this.stats.forEach((v, k) => { out[k] = v; });
    return out;
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private buildKey(cacheKey: string, key: string): string {
    return `${cacheKey}:${key}`;
  }

  /** Past staleAt but possibly still within expiresAt (SWR window) */
  private isSoftExpired(item: CacheItem<unknown>): boolean {
    if (!item.staleAt) return false;
    return Date.now() > item.staleAt;
  }

  /** Past expiresAt — absolutely do not serve */
  private isHardExpired(item: CacheItem<unknown>): boolean {
    if (item.version !== CACHE_VERSION) return true;
    if (item.expiresAt === null) return false; // permanent
    return Date.now() > item.expiresAt;
  }

  private isValidValue(v: unknown): boolean {
    if (v === null || v === undefined) return false;
    if (Array.isArray(v) && v.length === 0) return false;
    if (typeof v === 'string' && !v.trim()) return false;
    if (typeof v === 'object' && v !== null && Object.keys(v).length === 0) return false;
    return true;
  }

  private spawnBackgroundRefresh<T>(
    cacheKey: string,
    key: string,
    fetchFn: () => Promise<T>,
    config: CacheConfig,
  ): void {
    const bgKey = `bg:${this.buildKey(cacheKey, key)}`;
    if (this.pending.has(bgKey)) return;

    const p = fetchFn()
      .then(async (data) => {
        await this.setWithConfig(cacheKey, key, data, config);
        const s = this.stats.get(cacheKey);
        if (s) s.backgroundRefreshes++;
        console.log(`🔄 [Cache] BG refresh done: ${this.buildKey(cacheKey, key)}`);
      })
      .catch((err) => console.error(`❌ [Cache] BG refresh failed:`, err))
      .finally(() => this.pending.delete(bgKey));

    this.pending.set(bgKey, p as Promise<unknown>);
  }

  private spawnEpisodeBackgroundRefresh<T>(
    animeId: string,
    fetchFn: () => Promise<T>,
    animeInfo?: { status?: string; totalEpisodes?: number },
  ): void {
    const bgKey = `bg:Episodes:${animeId}`;
    if (this.pending.has(bgKey)) return;

    const p = fetchFn()
      .then(async (data) => {
        await this.setEpisodes(animeId, data, animeInfo ?? (data as unknown as { status?: string; totalEpisodes?: number }));
        console.log(`🔄 [Cache] BG episode refresh done: ${animeId}`);
      })
      .catch((err) => console.error(`❌ [Cache] BG episode refresh failed:`, err))
      .finally(() => this.pending.delete(bgKey));

    this.pending.set(bgKey, p as Promise<unknown>);
  }

  // ── LocalStorage helpers ──────────────────────────────────────────────────

  private lsRead<T>(key: string): CacheItem<T> | null {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const item = JSON.parse(raw) as CacheItem<T>;
      if (item.version !== CACHE_VERSION) {
        localStorage.removeItem(key);
        return null;
      }
      return item;
    } catch {
      return null;
    }
  }

  private lsWrite<T>(key: string, item: CacheItem<T>): void {
    try {
      localStorage.setItem(key, JSON.stringify(item));
    } catch (err: unknown) {
      const e = err as { name?: string; code?: number };
      if (e?.name === 'QuotaExceededError' || e?.code === 22) {
        console.warn('⚠️ [Cache] LocalStorage quota — running LRU eviction');
        this.lruEvict();
        try { localStorage.setItem(key, JSON.stringify(item)); } catch { /* give up */ }
      }
    }
  }

  /**
   * LRU eviction: remove the oldest 30% of non-permanent LocalStorage entries.
   */
  private lruEvict(): void {
    type LsEntry = { key: string; createdAt: number };
    const candidates: LsEntry[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      try {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const item = JSON.parse(raw) as CacheItem<unknown>;
        if (item.strategy === 'permanent') continue; // never evict permanent
        candidates.push({ key: k, createdAt: item.createdAt ?? 0 });
      } catch {
        candidates.push({ key: k, createdAt: 0 });
      }
    }

    candidates.sort((a, b) => a.createdAt - b.createdAt); // oldest first
    const target = Math.max(1, Math.ceil(candidates.length * 0.3));
    candidates.slice(0, target).forEach(({ key }) => localStorage.removeItem(key));
    console.log(`🗑️ [Cache] LRU evicted ${target} LocalStorage entries`);
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  private runStartupCleanup(): void {
    let removed = 0;
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      const item = this.lsRead<unknown>(k);
      if (!item || this.isHardExpired(item)) toRemove.push(k);
    }
    toRemove.forEach((k) => { localStorage.removeItem(k); removed++; });
    if (removed) console.log(`🧹 [Cache] Startup: removed ${removed} expired LS entries`);
  }

  private scheduleHourlyCleanup(): void {
    setInterval(() => this.runStartupCleanup(), 60 * 60 * 1_000);
  }

  // ── Stats helpers ─────────────────────────────────────────────────────────

  private ensureStats(key: string): void {
    if (!this.stats.has(key)) this.stats.set(key, this.emptyStats());
  }

  private emptyStats(): CacheStats {
    return {
      hits: 0, misses: 0, staleHits: 0,
      backgroundRefreshes: 0, errors: 0,
      sizeBytes: 0, lastUpdated: Date.now(),
    };
  }

  private recordHit(key: string, _source: string, isStale: boolean): void {
    const s = this.stats.get(key);
    if (!s) return;
    if (isStale) s.staleHits++;
    else s.hits++;
    s.lastUpdated = Date.now();
  }

  private recordMiss(key: string): void {
    const s = this.stats.get(key);
    if (s) { s.misses++; s.lastUpdated = Date.now(); }
  }

  private recordError(key: string): void {
    const s = this.stats.get(key);
    if (s) s.errors++;
  }

  private updateSizeStats(key: string): void {
    const s = this.stats.get(key);
    if (!s) return;
    const prefix = `${key}:`;
    let bytes = 0;
    for (const [k, v] of this.mem.entries()) {
      if (k.startsWith(prefix)) bytes += JSON.stringify(v).length;
    }
    s.sizeBytes = bytes;
    s.lastUpdated = Date.now();
  }
}

export const cacheManager = new CacheManager();
export { CacheManager };