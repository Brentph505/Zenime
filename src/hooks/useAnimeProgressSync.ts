/**
 * useAnimeProgressSync.ts
 *
 * Background sync of local watch history → AniList. Merges legacy localStorage,
 * the size-capped cache, and IndexedDB (where Watch.tsx stores full history).
 * Uses syncWatchProgressBatch so multiple entries are pushed in a single
 * batched AniList request (plus 1 read of the current list to resolve
 * status/airing-episode rules), instead of up to 2 requests PER anime.
 *
 * Rate-limit notes:
 *  - Listens to WATCH_HISTORY_CHANGED_EVENT only — NOT the generic 'storage'
 *    event and NOT ANILIST_REMOTE_PATCH_EVENT — so that patches originating
 *    from AniList itself (via useSyncAniListHistory's patchSingleEntry)
 *    don't get pushed straight back to AniList in a loop.
 *  - On 429, backs off using the Retry-After header instead of retrying
 *    immediately on the next interval tick.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuth } from '../client/useAuth';
import { useSettings } from '../components/Profile/SettingsProvider';
import { syncWatchProgressBatch, isAniListRateLimitError } from '../client/authService';
import {
  WATCH_HISTORY_CHANGED_EVENT,
  getAllWatchedAnimeMap,
  getLastAnimeVisitedMap,
  getWatchedCount,
} from '../lib/watchHistory';

const SYNC_INTERVAL_MS = 5 * 60 * 1000;
const FULL_SYNC_COOLDOWN_MS = 60 * 1000;
const PROGRESS_SYNCED_KEY = 'anime-progress-synced';
const MAX_ANIME_PER_BATCH = 8;

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
  const { isLoggedIn, userData } = useAuth();
  const { settings } = useSettings();
  const syncIntervalRef = useRef<number | null>(null);
  const isSyncingRef = useRef(false);
  const lastFullSyncAtRef = useRef(0);
  const backoffUntilRef = useRef(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const lastSyncRef = useRef<SyncedProgress>((() => {
    try {
      const stored = localStorage.getItem(PROGRESS_SYNCED_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  })());

  const syncAllProgress = useCallback(async (force = false) => {
    if (!isLoggedIn) return;
    if (!settings.aniListSync && !force) return;
    if (isSyncingRef.current) return;

    const now = Date.now();
    if (!force && now < backoffUntilRef.current) return;
    if (!force && now - lastFullSyncAtRef.current < FULL_SYNC_COOLDOWN_MS) {
      return;
    }

    const token = getAccessToken();
    if (!token) return;

    const username = userData?.name;
    if (!username) return;

    lastFullSyncAtRef.current = now;
    isSyncingRef.current = true;
    setIsSyncing(true);
    try {
      const watchedEpisodes = await getAllWatchedAnimeMap();
      const lastAnimeVisited = getLastAnimeVisitedMap();
      void lastAnimeVisited; // kept for future use (e.g. total episode hints); not needed now that the batch fn fetches fresh state itself

      const candidateIds = Object.keys(watchedEpisodes)
        .filter((animeId) => {
          const watchedCount = getWatchedCount(watchedEpisodes[animeId]);
          const lastSynced = lastSyncRef.current[animeId]?.lastSyncedEpisode ?? 0;
          return watchedCount > 0 && (force || watchedCount > lastSynced);
        })
        .sort((a, b) => {
          const pa = getWatchedCount(watchedEpisodes[a]);
          const pb = getWatchedCount(watchedEpisodes[b]);
          return pb - pa;
        });

      if (candidateIds.length === 0) return;

      const idsToSync = candidateIds.slice(0, MAX_ANIME_PER_BATCH);

      const entries = idsToSync
        .map((animeId) => {
          const numericId = parseInt(animeId, 10);
          const watchedCount = getWatchedCount(watchedEpisodes[animeId]);
          if (Number.isNaN(numericId) || watchedCount <= 0) return null;
          return { animeId, mediaId: numericId, progress: watchedCount };
        })
        .filter((e): e is { animeId: string; mediaId: number; progress: number } => e !== null);

      if (entries.length === 0) return;

      try {
        const result = await syncWatchProgressBatch(
          token,
          username,
          entries.map(({ mediaId, progress }) => ({ mediaId, progress })),
        );

        entries.forEach(({ animeId, progress }) => {
          lastSyncRef.current[animeId] = { syncedAt: Date.now(), lastSyncedEpisode: progress };
        });
        localStorage.setItem(PROGRESS_SYNCED_KEY, JSON.stringify(lastSyncRef.current));
        console.log(
          `[AnimeSync] Batch synced ${Object.keys(result ?? {}).length} anime in 2 requests (1 read + 1 batched write)`,
        );
      } catch (error: any) {
        if (isAniListRateLimitError(error)) {
          const waitMs = error.retryAfter * 1000;
          backoffUntilRef.current = Date.now() + waitMs;
          console.warn(`[AnimeSync] Rate limited, backing off ${error.retryAfter}s`);
        } else {
          console.error('[AnimeSync] Batch sync failed:', error);
        }
      }
    } catch (error) {
      console.error('[AnimeSync] Failed to sync all progress:', error);
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, [isLoggedIn, settings.aniListSync, userData?.name]);

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

  // NOTE: intentionally listening ONLY to WATCH_HISTORY_CHANGED_EVENT and
  // 'online' here — genuine local watch-progress changes (video player,
  // manual episode marking). We do NOT listen to the generic 'storage' event
  // or ANILIST_REMOTE_PATCH_EVENT, since those can originate from AniList
  // itself and would otherwise create a read→write→read loop.
  useEffect(() => {
    const handleChange = () => {
      if (isLoggedIn && settings.aniListSync) {
        void syncAllProgress();
      }
    };

    window.addEventListener(WATCH_HISTORY_CHANGED_EVENT, handleChange);
    window.addEventListener('online', handleChange);
    return () => {
      window.removeEventListener(WATCH_HISTORY_CHANGED_EVENT, handleChange);
      window.removeEventListener('online', handleChange);
    };
  }, [isLoggedIn, settings.aniListSync, syncAllProgress]);

  return {
    syncNow: () => syncAllProgress(true),
    isSyncing,
  };
}