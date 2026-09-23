/**
 * useAnimeProgressSync.ts
 *
 * Background sync of local watch history → AniList. Merges legacy localStorage,
 * the size-capped cache, and IndexedDB (where Watch.tsx stores full history).
 * Uses syncWatchProgress so entries are created automatically (PLANNING→CURRENT).
 */

import { useEffect, useRef, useCallback, useState } from 'react';
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
const MAX_ANIME_PER_BATCH = 10;
const RATE_LIMIT_DELAY_MS = 2500;

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
  const syncIntervalRef = useRef<number | null>(null);
  const isSyncingRef = useRef(false);
  const lastRequestAtRef = useRef(0);
  const [isSyncing, setIsSyncing] = useState(false);
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

      if (watchedEpisodes < 1) return;

      const lastSync = lastSyncRef.current[animeId];
      if (lastSync && lastSync.lastSyncedEpisode >= watchedEpisodes) {
        return;
      }

      const numericId = parseInt(animeId, 10);
      if (Number.isNaN(numericId)) return;

      const now = Date.now();
      const elapsed = now - lastRequestAtRef.current;
      if (elapsed < RATE_LIMIT_DELAY_MS) {
        await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY_MS - elapsed));
      }
      lastRequestAtRef.current = Date.now();

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
    [isLoggedIn],
  );

  const syncAllProgress = useCallback(async (force = false) => {
    if (!isLoggedIn) return;
    if (!settings.aniListSync && !force) return;
    if (isSyncingRef.current) return;

    isSyncingRef.current = true;
    setIsSyncing(true);
    try {
      const watchedEpisodes = await getAllWatchedAnimeMap();
      const lastAnimeVisited = getLastAnimeVisitedMap();

      const animeIds = Object.keys(watchedEpisodes).filter((animeId) => {
        const watchedCount = getWatchedCount(watchedEpisodes[animeId]);
        return watchedCount > 0;
      });

      if (animeIds.length === 0) return;

      for (let i = 0; i < animeIds.length; i += MAX_ANIME_PER_BATCH) {
        const batch = animeIds.slice(i, i + MAX_ANIME_PER_BATCH);

        for (const animeId of batch) {
          const watchedCount = getWatchedCount(watchedEpisodes[animeId]);
          if (watchedCount <= 0) continue;

          const meta = lastAnimeVisited[animeId];
          const totalEpisodes =
            (meta?.totalEpisodes as number | null | undefined) ??
            (meta?.total_episodes as number | null | undefined) ??
            null;

          await syncProgressToAniList(animeId, watchedCount, totalEpisodes);
        }

        if (i + MAX_ANIME_PER_BATCH < animeIds.length) {
          await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
        }
      }
    } catch (error) {
      console.error('[AnimeSync] Failed to sync all progress:', error);
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, [isLoggedIn, settings.aniListSync, syncProgressToAniList]);

  useEffect(() => {
    return () => setIsSyncing(false);
  }, []);

  useEffect(() => {
    if (!isLoggedIn || !settings.aniListSync) {
      if (syncIntervalRef.current) {
        window.clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
      return;
    }

    void syncAllProgress();

    syncIntervalRef.current = window.setInterval(() => {
      void syncAllProgress();
    }, SYNC_INTERVAL_MS);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void syncAllProgress();
      }
    };

    const handleFocus = () => {
      void syncAllProgress();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);

    return () => {
      if (syncIntervalRef.current) window.clearInterval(syncIntervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
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
    window.addEventListener('online', handleChange);
    return () => {
      window.removeEventListener(WATCH_HISTORY_CHANGED_EVENT, handleChange);
      window.removeEventListener('storage', handleChange);
      window.removeEventListener('online', handleChange);
    };
  }, [isLoggedIn, settings.aniListSync, syncAllProgress]);

  return {
    syncNow: () => syncAllProgress(true),
    isSyncing,
  };
}
