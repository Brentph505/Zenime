/**
 * Cache Invalidation Utilities
 * Handles invalidating cache entries when data changes
 */

import { cacheManager } from './cacheManager';

/**
 * Invalidate cache entries when new episodes are added
 */
export async function invalidateEpisodeCache(animeId: string): Promise<void> {
  try {
    // Invalidate specific anime episodes
    await cacheManager.invalidatePattern('Episodes', animeId);

    // Invalidate recent episodes (since this anime might be in recent episodes)
    await cacheManager.invalidatePattern('Recent Episodes');

    console.log(`🔄 [Cache] Invalidated episode cache for anime ${animeId}`);
  } catch (error) {
    console.error(`❌ [Cache] Failed to invalidate episode cache:`, error);
  }
}

/**
 * Invalidate cache entries when airing schedule updates
 */
export async function invalidateAiringScheduleCache(): Promise<void> {
  try {
    // Invalidate all airing schedule entries
    await cacheManager.invalidatePattern('Airing Schedule');

    console.log(`🔄 [Cache] Invalidated airing schedule cache`);
  } catch (error) {
    console.error(`❌ [Cache] Failed to invalidate airing schedule cache:`, error);
  }
}

/**
 * Invalidate cache entries when anime info is updated
 */
export async function invalidateAnimeInfoCache(animeId: string): Promise<void> {
  try {
    // Invalidate specific anime info
    await cacheManager.invalidatePattern('Info', animeId);

    // Invalidate data cache as well
    await cacheManager.invalidatePattern('Data', animeId);

    console.log(`🔄 [Cache] Invalidated info/data cache for anime ${animeId}`);
  } catch (error) {
    console.error(`❌ [Cache] Failed to invalidate anime info cache:`, error);
  }
}

/**
 * Force refresh trending/popular/top anime lists
 */
export async function refreshAnimeLists(): Promise<void> {
  try {
    const lists = ['TopRated', 'Trending', 'Popular', 'TopAiring', 'Upcoming'];

    for (const list of lists) {
      // Force refresh each list
      await cacheManager.invalidatePattern(list);
    }

    console.log(`🔄 [Cache] Refreshed all anime lists`);
  } catch (error) {
    console.error(`❌ [Cache] Failed to refresh anime lists:`, error);
  }
}

/**
 * Clear all cache entries (useful for maintenance)
 */
export async function clearAllCache(): Promise<void> {
  try {
    await cacheManager.clearAll();
    console.log(`🧹 [Cache] Cleared all cache entries`);
  } catch (error) {
    console.error(`❌ [Cache] Failed to clear all cache:`, error);
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return cacheManager.getStats();
}

/**
 * Setup periodic cache refresh for frequently changing data
 */
export function setupPeriodicRefresh(): void {
  // Refresh airing schedule every hour
  setInterval(async () => {
    try {
      await invalidateAiringScheduleCache();
    } catch (error) {
      console.error(`❌ [Cache] Periodic airing schedule refresh failed:`, error);
    }
  }, 60 * 60 * 1000); // Every hour

  // Refresh recent episodes every 2 hours
  setInterval(async () => {
    try {
      await cacheManager.invalidatePattern('Recent Episodes');
    } catch (error) {
      console.error(`❌ [Cache] Periodic recent episodes refresh failed:`, error);
    }
  }, 2 * 60 * 60 * 1000); // Every 2 hours

  // Refresh trending/popular lists every 6 hours
  setInterval(async () => {
    try {
      await refreshAnimeLists();
    } catch (error) {
      console.error(`❌ [Cache] Periodic anime lists refresh failed:`, error);
    }
  }, 6 * 60 * 60 * 1000); // Every 6 hours

  console.log('⏰ [Cache] Periodic refresh system initialized');
}
