/**
 * useAnimeProgressSync.ts
 *
 * Syncs local anime episode progress to AniList when:
 * 1. User is logged in
 * 2. autosync is enabled
 * 3. Episode progress reaches syncThreshold % (default 80%)
 *
 * Watches localStorage 'watched-episodes' and syncs to AniList progress field
 */

import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../client/useAuth';
import { useSettings } from '../components/Profile/SettingsProvider';

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // Sync every 5 minutes
const PROGRESS_SYNCED_KEY = 'anime-progress-synced';

interface SyncedProgress {
  [animeId: string]: {
    syncedAt: number;
    lastSyncedEpisode: number;
  };
}

/**
 * Hook to auto-sync local anime episode progress to AniList.
 * When autosync is enabled and user is logged in, periodically syncs
 * watched episodes to the user's AniList entry.
 */
export function useAnimeProgressSync() {
  const { isLoggedIn, saveEntry, getUserMediaState } = useAuth();
  const { settings } = useSettings();
  const syncIntervalRef = useRef<NodeJS.Timeout>();
  const lastSyncRef = useRef<SyncedProgress>((() => {
    try {
      const stored = localStorage.getItem(PROGRESS_SYNCED_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  })());

  /**
   * Syncs a single anime's episode progress to AniList.
   * Only syncs if progress >= syncThreshold %
   */
  const syncProgressToAniList = useCallback(
    async (animeId: string, watchedEpisodes: number, totalEpisodes: number | null) => {
      if (!isLoggedIn || !saveEntry) {
        return;
      }

      // Don't sync if we don't know total episodes
      if (!totalEpisodes || totalEpisodes <= 0) {
        return;
      }

      // Calculate progress percentage
      const progressPercentage = (watchedEpisodes / totalEpisodes) * 100;

      // Only sync if meets threshold
      if (progressPercentage < settings.syncThreshold) {
        return;
      }

      // Check if already synced at this episode
      const lastSync = lastSyncRef.current[animeId];
      if (lastSync && lastSync.lastSyncedEpisode >= watchedEpisodes) {
        return; // Already synced at or past this episode
      }

      try {
        const numericId = parseInt(animeId, 10);
        if (Number.isNaN(numericId)) {
          return;
        }

        // Get current entry to preserve other fields
        const currentEntry = await getUserMediaState(numericId);
        const entry = currentEntry?.entry;

        // Only sync if entry exists on AniList
        if (!entry) {
          return;
        }

        // Save progress update
        const result = await saveEntry({
          mediaId: numericId,
          progress: watchedEpisodes,
          status: entry.status, // Preserve existing status
          score: entry.score,
        });

        if (result) {
          // Update sync tracking
          lastSyncRef.current[animeId] = {
            syncedAt: Date.now(),
            lastSyncedEpisode: watchedEpisodes,
          };

          localStorage.setItem(
            PROGRESS_SYNCED_KEY,
            JSON.stringify(lastSyncRef.current),
          );

          console.log(
            `[AnimeSync] Synced ${animeId} to ${watchedEpisodes}/${totalEpisodes} episodes`,
          );
        }
      } catch (error) {
        console.error(`[AnimeSync] Failed to sync anime ${animeId}:`, error);
      }
    },
    [isLoggedIn, saveEntry, getUserMediaState, settings.syncThreshold],
  );

  /**
   * Syncs all watched anime to AniList
   */
  const syncAllProgress = useCallback(async () => {
    if (!isLoggedIn || !settings.aniListSync) {
      return;
    }

    try {
      // Get watched episodes and anime metadata
      const watchedEpisodesData = localStorage.getItem('watched-episodes');
      const lastAnimeVisitedData = localStorage.getItem('last-anime-visited');

      if (!watchedEpisodesData || !lastAnimeVisitedData) {
        return;
      }

      const watchedEpisodes: Record<string, number> = JSON.parse(
        watchedEpisodesData,
      );
      const lastAnimeVisited: Record<string, any> = JSON.parse(
        lastAnimeVisitedData,
      );

      // Sync each anime
      for (const animeId of Object.keys(watchedEpisodes)) {
        const watchedCount = watchedEpisodes[animeId];
        const animeInfo = lastAnimeVisited[animeId];
        const totalEpisodes = animeInfo?.totalEpisodes;

        if (watchedCount > 0) {
          // Rate limit: 500ms between requests
          await new Promise((resolve) => setTimeout(resolve, 500));
          await syncProgressToAniList(animeId, watchedCount, totalEpisodes);
        }
      }
    } catch (error) {
      console.error('[AnimeSync] Failed to sync all progress:', error);
    }
  }, [isLoggedIn, settings.aniListSync, syncProgressToAniList]);

  // Setup periodic sync
  useEffect(() => {
    if (!isLoggedIn || !settings.aniListSync) {
      // Clear interval if autosync disabled
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = undefined;
      }
      return;
    }

    // Initial sync
    syncAllProgress();

    // Setup periodic sync
    syncIntervalRef.current = setInterval(() => {
      syncAllProgress();
    }, SYNC_INTERVAL_MS);

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [isLoggedIn, settings.aniListSync, syncAllProgress]);

  // Watch for watched episodes changes
  useEffect(() => {
    const handleStorageChange = () => {
      if (isLoggedIn && settings.aniListSync) {
        syncAllProgress();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [isLoggedIn, settings.aniListSync, syncAllProgress]);
}
