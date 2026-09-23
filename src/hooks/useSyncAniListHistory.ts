/**
 * useSyncAniListHistory.ts
 *
 * On login, pulls the viewer's AniList anime list and merges it into local
 * storage so History / continue-watching work on new devices.
 *
 * Stores progress as synthetic Episode objects (not bare numbers) so History
 * and EpisodeList can read a consistent shape.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../client/useAuth';
import { fetchUserList } from '../client/authService';
import { safeLocalStorageSet } from '../lib/safeStorage';
import { useSettings } from '../components/Profile/SettingsProvider';
import {
  WATCHED_EPISODES_KEY,
  LAST_ANIME_VISITED_KEY,
  WATCH_HISTORY_CHANGED_EVENT,
  buildSyntheticEpisode,
  getWatchedCount,
  normalizeToEpisodeArray,
  dispatchWatchHistoryChanged,
} from '../lib/watchHistory';

const HISTORY_SYNCED_KEY = 'anilist-history-synced';

export function useSyncAniListHistory() {
  const { isLoggedIn, userData } = useAuth();
  const { settings } = useSettings();
  const hasSyncedRef = useRef(false);
  const [syncTrigger, setSyncTrigger] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const requestSync = useCallback(() => {
    hasSyncedRef.current = false;
    setSyncTrigger((n) => n + 1);
  }, []);

  useEffect(() => {
    const onEntryChanged = () => requestSync();
    const onWatchHistoryChanged = () => requestSync();
    const onStorage = (event: StorageEvent) => {
      if (
        event.key === null ||
        event.key === WATCHED_EPISODES_KEY ||
        event.key === LAST_ANIME_VISITED_KEY ||
        event.key === HISTORY_SYNCED_KEY
      ) {
        requestSync();
      }
    };

    window.addEventListener('anilist-entry-changed', onEntryChanged);
    window.addEventListener(WATCH_HISTORY_CHANGED_EVENT, onWatchHistoryChanged);
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener('anilist-entry-changed', onEntryChanged);
      window.removeEventListener(WATCH_HISTORY_CHANGED_EVENT, onWatchHistoryChanged);
      window.removeEventListener('storage', onStorage);
    };
  }, [requestSync]);

  const isHentaiAnime = (genres: string[] = []) =>
    genres.some((g) => g.toLowerCase() === 'hentai');

  const isNsfwAnime = (genres: string[] = [], isAdult?: boolean) =>
    Boolean(isAdult) || genres.some((g) => g.toLowerCase() === 'ecchi');

  useEffect(() => {
    hasSyncedRef.current = false;
  }, [settings.saveHentaiHistory, settings.saveNSFWHistory]);

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
      setIsSyncing(true);
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

          const genres: string[] = entry.media?.genres ?? [];
          const isHentai = isHentaiAnime(genres);
          const isNsfw = isNsfwAnime(genres, entry.media?.isAdult);

          if (isHentai && !settings.saveHentaiHistory) {
            if (animeId in localLastVisited) {
              delete localLastVisited[animeId];
              visitedChanged = true;
            }
            if (animeId in localWatchedEpisodes) {
              delete localWatchedEpisodes[animeId];
              historyChanged = true;
            }
            continue;
          }
          if (!isHentai && isNsfw && !settings.saveNSFWHistory) {
            if (animeId in localLastVisited) {
              delete localLastVisited[animeId];
              visitedChanged = true;
            }
            if (animeId in localWatchedEpisodes) {
              delete localWatchedEpisodes[animeId];
              historyChanged = true;
            }
            continue;
          }

          if (!entry.media?.title?.romaji && !entry.media?.title?.english) {
            console.warn(`[HistorySync] Skipping entry ${animeId} with invalid title`);
            continue;
          }

          const anilistProgress = entry.progress || 0;
          const existingVisited = localLastVisited[animeId] || {};
          const existingAnilistProgress = Number(existingVisited.anilistProgress ?? 0);
          const localProgress = getWatchedCount(localWatchedEpisodes[animeId]);
          const nextAiringEpisode = entry.media?.nextAiringEpisode?.episode;
          const airingEpisodeLimit =
            entry.media?.status === 'RELEASING' && nextAiringEpisode != null
              ? Math.max(0, nextAiringEpisode - 1)
              : null;
          const mergedProgress = Math.max(
            anilistProgress,
            localProgress,
            existingAnilistProgress,
          );
          const effectiveProgress =
            airingEpisodeLimit == null
              ? mergedProgress
              : Math.min(mergedProgress, airingEpisodeLimit);

          const anilistUpdatedAt = entry.updatedAt ? entry.updatedAt * 1000 : null;
          const mergedVisited = {
            ...existingVisited,
            timestamp: anilistUpdatedAt ?? existingVisited.timestamp ?? Date.now(),
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
            coverImage:
              existingVisited.coverImage ||
              entry.media?.coverImage?.large ||
              entry.media?.coverImage?.medium ||
              null,
            genres: existingVisited.genres ?? genres,
            isAdult: existingVisited.isAdult ?? entry.media?.isAdult ?? false,
          };

          if (JSON.stringify(mergedVisited) !== JSON.stringify(existingVisited)) {
            localLastVisited[animeId] = mergedVisited;
            visitedChanged = true;
          }

          if (effectiveProgress > localProgress) {
            const current = localWatchedEpisodes[animeId];
            if (Array.isArray(current)) {
              const localMax = getWatchedCount(current);
              if (effectiveProgress > localMax) {
                localWatchedEpisodes[animeId] = normalizeToEpisodeArray(
                  animeId,
                  current,
                  effectiveProgress,
                );
                historyChanged = true;
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
      } finally {
        if (!cancelled) {
          setIsSyncing(false);
        }
      }
    };

    void syncHistory();

    return () => {
      cancelled = true;
      setIsSyncing(false);
    };
  }, [isLoggedIn, userData?.name, settings.saveHentaiHistory, settings.saveNSFWHistory, syncTrigger]);

  return {
    syncNow: requestSync,
    isSyncing,
  };
}
