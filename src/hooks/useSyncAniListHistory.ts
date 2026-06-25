/**
 * useSyncAniListHistory.ts
 *
 * On login, pulls the viewer's AniList anime list and merges it into local
 * storage so History / continue-watching work on new devices.
 *
 * Stores progress as synthetic Episode objects (not bare numbers) so History
 * and EpisodeList can read a consistent shape.
 */

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../client/useAuth';
import { fetchUserList } from '../client/authService';
import { safeLocalStorageSet } from '../lib/safeStorage';
import {
  WATCHED_EPISODES_KEY,
  LAST_ANIME_VISITED_KEY,
  buildSyntheticEpisode,
  getWatchedCount,
  normalizeToEpisodeArray,
  dispatchWatchHistoryChanged,
} from '../lib/watchHistory';

const HISTORY_SYNCED_KEY = 'anilist-history-synced';

export function useSyncAniListHistory() {
  const { isLoggedIn, userData } = useAuth();
  const hasSyncedRef = useRef(false);
  const [syncTrigger, setSyncTrigger] = useState(0);

  // Re-run sync whenever an AniList entry is saved/deleted so the UI
  // reflects the changes on any device without requiring a full re-login.
  useEffect(() => {
    const onEntryChanged = () => {
      hasSyncedRef.current = false;
      setSyncTrigger((n) => n + 1);
    };
    window.addEventListener('anilist-entry-changed', onEntryChanged);
    return () => window.removeEventListener('anilist-entry-changed', onEntryChanged);
  }, []);

  useEffect(() => {
    if (!isLoggedIn || !userData?.name) {
      hasSyncedRef.current = false;
      return;
    }

    if (hasSyncedRef.current) {
      return;
    }

    let cancelled = false;

    const syncHistory = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        if (!token) {
          console.warn('[HistorySync] No auth token available');
          return;
        }

        const username = userData.name;
        const statuses: Array<
          'CURRENT' | 'PLANNING' | 'COMPLETED' | 'PAUSED' | 'DROPPED' | 'REPEATING'
        > = ['CURRENT', 'PLANNING', 'COMPLETED', 'PAUSED', 'DROPPED', 'REPEATING'];

        const allEntries = [];
        for (const status of statuses) {
          if (cancelled) return;
          try {
            const entries = await fetchUserList(token, username, 'ANIME', status);
            allEntries.push(...entries);
          } catch (error) {
            console.warn(`[HistorySync] Failed to fetch ${status} list:`, error);
          }
          await new Promise((resolve) => setTimeout(resolve, 200));
        }

        if (cancelled || allEntries.length === 0) {
          return;
        }

        const localWatchedEpisodes: Record<string, unknown> = (() => {
          try {
            const data = localStorage.getItem(WATCHED_EPISODES_KEY);
            return data ? JSON.parse(data) : {};
          } catch {
            return {};
          }
        })();

        const localLastVisited: Record<string, Record<string, unknown>> = (() => {
          try {
            const data = localStorage.getItem(LAST_ANIME_VISITED_KEY);
            return data ? JSON.parse(data) : {};
          } catch {
            return {};
          }
        })();

        let historyChanged = false;
        let visitedChanged = false;

        for (const entry of allEntries) {
          const animeId = entry.media?.id?.toString();
          if (!animeId) continue;

          if (!entry.media?.title?.romaji && !entry.media?.title?.english) {
            console.warn(`[HistorySync] Skipping entry ${animeId} with invalid title`);
            continue;
          }

          const anilistProgress = entry.progress || 0;
          const existingVisited = localLastVisited[animeId] || {};
          const existingAnilistProgress = Number(existingVisited.anilistProgress ?? 0);
          const localProgress = getWatchedCount(localWatchedEpisodes[animeId]);
          const effectiveProgress = Math.max(anilistProgress, localProgress, existingAnilistProgress);

          // Always enrich last-anime-visited (titles, status, AniList progress, cover).
          const mergedVisited = {
            ...existingVisited,
            timestamp: existingVisited.timestamp ?? Date.now(),
            titleEnglish:
              existingVisited.titleEnglish ||
              entry.media?.title?.english ||
              entry.media?.title?.romaji ||
              'Unknown',
            titleRomaji:
              existingVisited.titleRomaji ||
              entry.media?.title?.romaji ||
              entry.media?.title?.english ||
              'Unknown',
            status: entry.status ?? existingVisited.status,
            anilistProgress: effectiveProgress,
            lastEpisodeNumber: effectiveProgress,
            totalEpisodes:
              entry.media?.episodes != null
                ? entry.media.episodes
                : existingVisited.totalEpisodes ?? null,
            // Store AniList cover image so History works cross-device.
            // Prefer any existing coverImage (e.g. episode thumbnail from local playback),
            // but always fall back to the AniList cover when it's missing.
            coverImage:
              existingVisited.coverImage ||
              entry.media?.coverImage?.large ||
              entry.media?.coverImage?.medium ||
              null,
          };

          if (JSON.stringify(mergedVisited) !== JSON.stringify(existingVisited)) {
            localLastVisited[animeId] = mergedVisited;
            visitedChanged = true;
          }

          // Update watched-episodes when AniList is ahead of local episode data.
          if (effectiveProgress > localProgress) {
            const current = localWatchedEpisodes[animeId];
            if (Array.isArray(current)) {
              const localMax = getWatchedCount(current);
              if (effectiveProgress > localMax) {
                // Keep real episode objects; History reads anilistProgress from last-anime-visited.
              }
            } else {
              localWatchedEpisodes[animeId] = [
                buildSyntheticEpisode(animeId, effectiveProgress),
              ];
              historyChanged = true;
            }
          } else if (
            typeof localWatchedEpisodes[animeId] === 'number' &&
            effectiveProgress > 0
          ) {
            // Migrate legacy bare-number entries to Episode[] shape.
            localWatchedEpisodes[animeId] = normalizeToEpisodeArray(
              animeId,
              localWatchedEpisodes[animeId],
              effectiveProgress,
            );
            historyChanged = true;
          }
        }

        if (historyChanged) {
          safeLocalStorageSet(WATCHED_EPISODES_KEY, JSON.stringify(localWatchedEpisodes));
        }
        if (visitedChanged) {
          safeLocalStorageSet(LAST_ANIME_VISITED_KEY, JSON.stringify(localLastVisited));
        }

        if (historyChanged || visitedChanged) {
          dispatchWatchHistoryChanged();
          try {
            window.dispatchEvent(new Event('storage'));
          } catch {
            /* non-browser */
          }
        }

        localStorage.setItem(
          HISTORY_SYNCED_KEY,
          JSON.stringify({ lastSyncAt: Date.now() }),
        );

        hasSyncedRef.current = true;
        console.log('[HistorySync] Successfully synced AniList history to local storage');
      } catch (error) {
        console.error('[HistorySync] Failed to sync AniList history:', error);
      }
    };

    void syncHistory();

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, userData?.name, syncTrigger]);
}
