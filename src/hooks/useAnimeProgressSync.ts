/**
 * useAnimeProgressSync.ts
 *
 * Background sync of local watch history → AniList. Merges legacy localStorage,
 * the size-capped cache, and IndexedDB (where Watch.tsx stores full history).
 * Uses syncWatchProgress so entries are created automatically (PLANNING→CURRENT).
 */

import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../client/useAuth';
import { useSettings } from '../components/Profile/SettingsProvider';
import { syncWatchProgress } from '../client/authService';
import {
  WATCH_HISTORY_CHANGED_EVENT,
  getAllWatchedAnimeMap,
  getLastAnimeVisitedMap,
  getWatchedCount,
} from '../lib/watchHistory';

const SYNC_INTERVAL_MS = 5 * 60 * 1000;
const PROGRESS_SYNCED_KEY = 'anime-progress-synced';

interface SyncedProgress {
  [animeId: string]: {
    syncedAt: number;
    lastSyncedEpisode: number;
  };
}

function getAccessToken(): string | null {
  try {
    const t = localStorage.getItem('accessToken');
    return t && t.length > 10 ? t : null;
  } catch {
    return null;
  }
}

export function useAnimeProgressSync() {
  const { isLoggedIn } = useAuth();
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

  const syncProgressToAniList = useCallback(
    async (animeId: string, watchedEpisodes: number, totalEpisodes: number | null) => {
      if (!isLoggedIn) return;

      const token = getAccessToken();
      if (!token) return;

      // When total is known, require the series-level threshold (% of show watched).
      if (totalEpisodes && totalEpisodes > 0) {
        const progressPercentage = (watchedEpisodes / totalEpisodes) * 100;
        if (progressPercentage < settings.syncThreshold) {
          return;
        }
      } else if (watchedEpisodes < 1) {
        return;
      }

      const lastSync = lastSyncRef.current[animeId];
      if (lastSync && lastSync.lastSyncedEpisode >= watchedEpisodes) {
        return;
      }

      const numericId = parseInt(animeId, 10);
      if (Number.isNaN(numericId)) return;

      try {
        const result = await syncWatchProgress(
          token,
          numericId,
          watchedEpisodes,
          totalEpisodes,
        );

        if (result) {
          lastSyncRef.current[animeId] = {
            syncedAt: Date.now(),
            lastSyncedEpisode: watchedEpisodes,
          };
          localStorage.setItem(
            PROGRESS_SYNCED_KEY,
            JSON.stringify(lastSyncRef.current),
          );
          console.log(
            `[AnimeSync] Synced ${animeId} → ${result.progress} episode(s) on AniList`,
          );
        }
      } catch (error) {
        console.error(`[AnimeSync] Failed to sync anime ${animeId}:`, error);
      }
    },
    [isLoggedIn, settings.syncThreshold],
  );

  const syncAllProgress = useCallback(async () => {
    if (!isLoggedIn || !settings.aniListSync) return;

    try {
      const watchedEpisodes = await getAllWatchedAnimeMap();
      const lastAnimeVisited = getLastAnimeVisitedMap();

      const animeIds = Object.keys(watchedEpisodes);
      if (animeIds.length === 0) return;

      for (const animeId of animeIds) {
        const watchedCount = getWatchedCount(watchedEpisodes[animeId]);
        if (watchedCount <= 0) continue;

        const meta = lastAnimeVisited[animeId];
        const totalEpisodes =
          (meta?.totalEpisodes as number | null | undefined) ??
          (meta?.total_episodes as number | null | undefined) ??
          null;

        await new Promise((resolve) => setTimeout(resolve, 500));
        await syncProgressToAniList(animeId, watchedCount, totalEpisodes);
      }
    } catch (error) {
      console.error('[AnimeSync] Failed to sync all progress:', error);
    }
  }, [isLoggedIn, settings.aniListSync, syncProgressToAniList]);

  useEffect(() => {
    if (!isLoggedIn || !settings.aniListSync) {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = undefined;
      }
      return;
    }

    void syncAllProgress();

    syncIntervalRef.current = setInterval(() => {
      void syncAllProgress();
    }, SYNC_INTERVAL_MS);

    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    };
  }, [isLoggedIn, settings.aniListSync, syncAllProgress]);

  useEffect(() => {
    const handleChange = () => {
      if (isLoggedIn && settings.aniListSync) {
        void syncAllProgress();
      }
    };

    window.addEventListener(WATCH_HISTORY_CHANGED_EVENT, handleChange);
    window.addEventListener('storage', handleChange);
    return () => {
      window.removeEventListener(WATCH_HISTORY_CHANGED_EVENT, handleChange);
      window.removeEventListener('storage', handleChange);
    };
  }, [isLoggedIn, settings.aniListSync, syncAllProgress]);
}
