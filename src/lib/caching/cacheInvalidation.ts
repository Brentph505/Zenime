/**
 * Cache Invalidation Utilities
 *
 * Smart invalidation grouped by event type:
 *  - New episode released     → invalidate episode caches for that anime only
 *  - Anime status changed     → re-evaluate episode cache strategy
 *  - Schedule updated         → invalidate airing schedule
 *  - Periodic maintenance     → refresh trending/popular lists
 */

import { cacheManager } from './cacheManager';
import { normalizeAnimeStatus } from './cacheConfig';

// ── Episode events ────────────────────────────────────────────────────────────

/**
 * Call this when a new episode is detected for an airing anime.
 * Does NOT invalidate completed anime (their episodes are immutable).
 */
export async function onNewEpisode(
  animeId: string,
  animeStatus?: string,
): Promise<void> {
  const status = normalizeAnimeStatus(animeStatus);

  // Completed/cancelled anime can't have new episodes — skip
  if (status === 'COMPLETED' || status === 'CANCELLED') {
    console.log(`⏭️ [Cache] onNewEpisode(${animeId}) skipped — status=${status}`);
    return;
  }

  try {
    // Invalidate only the episode cache for this specific anime
    await cacheManager.delete('Episodes', animeId);

    // Also clear from recent episodes list (this anime may appear there)
    await cacheManager.invalidatePattern('Recent Episodes');

    console.log(`🔄 [Cache] Episode cache invalidated for anime ${animeId}`);
  } catch (err) {
    console.error(`❌ [Cache] onNewEpisode(${animeId}) failed:`, err);
  }
}

/**
 * Call when a batch of episode updates is detected (e.g. after schedule sync).
 * More efficient than calling onNewEpisode for each anime individually.
 */
export async function onEpisodeBatchUpdate(
  updates: Array<{ animeId: string; status?: string }>,
): Promise<void> {
  const airingIds = updates
    .filter(({ status }) => {
      const s = normalizeAnimeStatus(status);
      return s !== 'COMPLETED' && s !== 'CANCELLED';
    })
    .map(({ animeId }) => animeId);

  if (!airingIds.length) return;

  try {
    await Promise.all(airingIds.map((id) => cacheManager.delete('Episodes', id)));
    await cacheManager.invalidatePattern('Recent Episodes');
    console.log(`🔄 [Cache] Batch episode invalidation — ${airingIds.length} anime`);
  } catch (err) {
    console.error(`❌ [Cache] onEpisodeBatchUpdate failed:`, err);
  }
}

// ── Anime status changes ──────────────────────────────────────────────────────

/**
 * Call when an anime transitions from ONGOING → COMPLETED.
 * This re-stores the episode cache as permanent so it's never evicted.
 */
export async function onAnimeCompleted(
  animeId: string,
  fetchEpisodes: () => Promise<unknown>,
): Promise<void> {
  try {
    console.log(`🏁 [Cache] Anime ${animeId} completed — upgrading episode cache to permanent`);

    // Remove the old SWR episode entry
    await cacheManager.delete('Episodes', animeId);

    // Fetch fresh episodes and store as permanent (COMPLETED strategy)
    const episodes = await fetchEpisodes();
    await cacheManager.setEpisodes(animeId, episodes, { status: 'COMPLETED' });

    console.log(`✅ [Cache] Episode cache for ${animeId} upgraded to permanent`);
  } catch (err) {
    console.error(`❌ [Cache] onAnimeCompleted(${animeId}) failed:`, err);
  }
}

/**
 * Invalidate anime info + data cache (call when metadata changes).
 * We keep the episode cache unless status changed.
 */
export async function onAnimeInfoUpdated(animeId: string): Promise<void> {
  try {
    await cacheManager.delete('Info', animeId);
    await cacheManager.delete('Data', animeId);
    console.log(`🔄 [Cache] Info/Data cache invalidated for anime ${animeId}`);
  } catch (err) {
    console.error(`❌ [Cache] onAnimeInfoUpdated(${animeId}) failed:`, err);
  }
}

// ── Schedule events ───────────────────────────────────────────────────────────

/** Invalidate the airing schedule (call after weekly schedule sync) */
export async function onScheduleUpdated(): Promise<void> {
  try {
    await cacheManager.invalidatePattern('Airing Schedule');
    console.log(`🔄 [Cache] Airing schedule invalidated`);
  } catch (err) {
    console.error(`❌ [Cache] onScheduleUpdated failed:`, err);
  }
}

// ── Lists ─────────────────────────────────────────────────────────────────────

/**
 * Invalidate all trending/popular/ranked lists.
 * Call when global rankings are expected to change (e.g. season rollover).
 */
export async function invalidateAnimeLists(): Promise<void> {
  const lists = ['Trending', 'Popular', 'TopRated', 'TopAiring', 'Upcoming'];
  try {
    await Promise.all(lists.map((k) => cacheManager.invalidatePattern(k)));
    console.log(`🔄 [Cache] All anime lists invalidated`);
  } catch (err) {
    console.error(`❌ [Cache] invalidateAnimeLists failed:`, err);
  }
}

// ── Full clear ────────────────────────────────────────────────────────────────

/** Nuclear option — wipe all caches (use for maintenance/debugging only) */
export async function clearAllCaches(): Promise<void> {
  await cacheManager.clearAll();
}

/** Get a summary of all cache statistics */
export function getCacheStats() {
  return cacheManager.getStats();
}

// ── Periodic maintenance ──────────────────────────────────────────────────────

let _periodicRefreshRunning = false;

/**
 * Start the periodic background refresh system.
 * Safe to call multiple times — only starts once.
 *
 * Schedule:
 *  - Every 1 hour:  Airing schedule refresh
 *  - Every 2 hours: Recent episodes check
 *  - Every 6 hours: Trending/popular lists refresh
 */
export function startPeriodicRefresh(): () => void {
  if (_periodicRefreshRunning) return () => {};
  _periodicRefreshRunning = true;

  const timers: ReturnType<typeof setInterval>[] = [];

  // Airing schedule — every hour
  timers.push(
    setInterval(async () => {
      try {
        await cacheManager.invalidatePattern('Airing Schedule');
      } catch {}
    }, 60 * 60 * 1_000),
  );

  // Recent episodes — every 2 hours
  timers.push(
    setInterval(async () => {
      try {
        await cacheManager.invalidatePattern('Recent Episodes');
      } catch {}
    }, 2 * 60 * 60 * 1_000),
  );

  // Trending/popular — every 6 hours
  timers.push(
    setInterval(async () => {
      try {
        await invalidateAnimeLists();
      } catch {}
    }, 6 * 60 * 60 * 1_000),
  );

  console.log('⏰ [Cache] Periodic refresh system started');

  // Return cleanup function
  return () => {
    timers.forEach(clearInterval);
    _periodicRefreshRunning = false;
    console.log('⏹️ [Cache] Periodic refresh stopped');
  };
}