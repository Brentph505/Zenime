/**
 * useSyncAniListHistory.ts
 *
 * On login, pulls the viewer's AniList anime list and merges it into local
 * storage so History / continue-watching work on new devices.
 *
 * Stores progress as synthetic Episode objects (not bare numbers) so History
 * and EpisodeList can read a consistent shape.
 *
 * Rate-limit notes:
 *  - Full list fetch uses fetchFullMediaListCollection (1 request for all
 *    statuses, instead of 6 separate per-status requests).
 *  - `anilist-entry-changed` (fired by useAniListEntry after a single
 *    mutation) is handled by patching just that one entry locally instead of
 *    re-running the full list sync.
 *  - requestSync() (full resync) is debounced so bursts of events collapse
 *    into a single sync instead of stacking.
 *  - Locally-applied patches dispatch ANILIST_REMOTE_PATCH_EVENT, NOT
 *    WATCH_HISTORY_CHANGED_EVENT/storage — those are reserved for genuine
 *    local watch-progress changes (video player), so we don't bounce this
 *    update back into useAnimeProgressSync as a "push to AniList" trigger.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../client/useAuth';
import { fetchFullMediaListCollection, isAniListRateLimitError } from '../client/authService';
import { safeLocalStorageSet } from '../lib/safeStorage';
import { useSettings } from '../components/Profile/SettingsProvider';
import {
  WATCHED_EPISODES_KEY,
  LAST_ANIME_VISITED_KEY,
  buildSyntheticEpisode,
  getWatchedCount,
  normalizeToEpisodeArray,
  dispatchWatchHistoryChanged,
  removeAnimeHistory,
  setAnimeAniListSyncDisabled,
  isAnimeAniListSyncDisabled,
} from '../lib/watchHistory';
import { ANILIST_ENTRY_CHANGED_EVENT } from './useAniListEntry';

const HISTORY_SYNCED_KEY = 'anilist-history-synced';
const PROGRESS_SYNCED_KEY = 'anime-progress-synced';
const REQUEST_SYNC_DEBOUNCE_MS = 1500;

/**
 * Fired when a single entry has been patched locally from an AniList-side
 * mutation (rating, status change, etc). Distinct from
 * WATCH_HISTORY_CHANGED_EVENT so useAnimeProgressSync doesn't treat this as
 * "new local progress to push back to AniList".
 */
export const ANILIST_REMOTE_PATCH_EVENT = 'anilist-remote-patch';

const dispatchRemotePatch = () => {
  try { window.dispatchEvent(new Event(ANILIST_REMOTE_PATCH_EVENT)); }
  catch { /* non-browser */ }
};

export function useSyncAniListHistory() {
  const { isLoggedIn, userData } = useAuth();
  const { settings } = useSettings();
  const hasSyncedRef = useRef(false);
  const [syncTrigger, setSyncTrigger] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const debounceRef = useRef<number | null>(null);

  const requestSync = useCallback(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      hasSyncedRef.current = false;
      setSyncTrigger((n) => n + 1);
    }, REQUEST_SYNC_DEBOUNCE_MS);
  }, []);

  const isHentaiAnime = (genres: string[] = []) =>
    genres.some((g) => g.toLowerCase() === 'hentai');

  const isNsfwAnime = (genres: string[] = [], isAdult?: boolean) =>
    Boolean(isAdult) || genres.some((g) => g.toLowerCase() === 'ecchi');

  // ── Patch a single entry into local storage without a full resync ─────────
  const patchSingleEntry = useCallback(
    async (mediaId: number, entry: any | null) => {
      if (!entry) {
        const animeId = mediaId.toString();
        setAnimeAniListSyncDisabled(animeId, false);
        await removeAnimeHistory(animeId);
        try {
          const synced = JSON.parse(localStorage.getItem(PROGRESS_SYNCED_KEY) || '{}');
          delete synced[animeId];
          safeLocalStorageSet(PROGRESS_SYNCED_KEY, JSON.stringify(synced));
        } catch {
          /* ignore malformed sync metadata */
        }
        dispatchRemotePatch();
        return;
      }

      const animeId = mediaId.toString();
      const genres: string[] = entry.media?.genres ?? [];
      const isHentai = isHentaiAnime(genres);
      const isNsfw = isNsfwAnime(genres, entry.media?.isAdult);

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

      if (isHentai && !settings.saveHentaiHistory) {
        if (animeId in localLastVisited) { delete localLastVisited[animeId]; visitedChanged = true; }
        if (animeId in localWatchedEpisodes) { delete localWatchedEpisodes[animeId]; historyChanged = true; }
      } else if (!isHentai && isNsfw && !settings.saveNSFWHistory) {
        if (animeId in localLastVisited) { delete localLastVisited[animeId]; visitedChanged = true; }
        if (animeId in localWatchedEpisodes) { delete localWatchedEpisodes[animeId]; historyChanged = true; }
      } else if (entry.media?.title?.romaji || entry.media?.title?.english) {
        const anilistProgress = entry.progress || 0;
        const existingVisited = localLastVisited[animeId] || {};
        const existingAnilistProgress = Number(existingVisited.anilistProgress ?? 0);
        const localProgress = getWatchedCount(localWatchedEpisodes[animeId]);
        const nextAiringEpisode = entry.media?.nextAiringEpisode?.episode;
        const airingEpisodeLimit =
          entry.media?.status === 'RELEASING' && nextAiringEpisode != null
            ? Math.max(0, nextAiringEpisode - 1)
            : null;
        const mergedProgress = Math.max(anilistProgress, localProgress, existingAnilistProgress);
        const effectiveProgress =
          airingEpisodeLimit == null ? mergedProgress : Math.min(mergedProgress, airingEpisodeLimit);

        const anilistUpdatedAt = entry.updatedAt ? entry.updatedAt * 1000 : null;
        const mergedVisited = {
          ...existingVisited,
          timestamp: anilistUpdatedAt ?? existingVisited.timestamp ?? Date.now(),
          titleEnglish: existingVisited.titleEnglish || entry.media?.title?.english || entry.media?.title?.romaji || 'Unknown',
          titleRomaji: existingVisited.titleRomaji || entry.media?.title?.romaji || entry.media?.title?.english || 'Unknown',
          status: entry.status ?? existingVisited.status,
          anilistProgress: effectiveProgress,
          lastEpisodeNumber: effectiveProgress,
          totalEpisodes: entry.media?.episodes != null ? entry.media.episodes : existingVisited.totalEpisodes ?? null,
          coverImage: existingVisited.coverImage || entry.media?.coverImage?.large || entry.media?.coverImage?.medium || null,
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
              localWatchedEpisodes[animeId] = normalizeToEpisodeArray(animeId, current, effectiveProgress);
              historyChanged = true;
            }
          } else {
            localWatchedEpisodes[animeId] = [buildSyntheticEpisode(animeId, effectiveProgress)];
            historyChanged = true;
          }
        } else if (typeof localWatchedEpisodes[animeId] === 'number' && effectiveProgress > 0) {
          localWatchedEpisodes[animeId] = normalizeToEpisodeArray(animeId, localWatchedEpisodes[animeId], effectiveProgress);
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
        // Notify UI (History/EpisodeList) to re-render, WITHOUT triggering
        // useAnimeProgressSync's push-to-AniList logic.
        dispatchRemotePatch();
      }
    },
    [settings.saveHentaiHistory, settings.saveNSFWHistory],
  );

  useEffect(() => {
    const onEntryChanged = (e: Event) => {
      const detail = (e as CustomEvent).detail as { mediaId?: number; entry?: any } | undefined;
      if (!detail?.mediaId) {
        requestSync(); // no detail available — fall back to a full (debounced) resync
        return;
      }
      void patchSingleEntry(detail.mediaId, detail.entry ?? null);
    };

    window.addEventListener(ANILIST_ENTRY_CHANGED_EVENT, onEntryChanged);
    return () => {
      window.removeEventListener(ANILIST_ENTRY_CHANGED_EVENT, onEntryChanged);
    };
  }, [requestSync, patchSingleEntry]);

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

        let allEntries: any[] = [];
        try {
          allEntries = await fetchFullMediaListCollection(token, username, 'ANIME');
        } catch (error: any) {
          if (isAniListRateLimitError(error)) {
            console.warn(`[HistorySync] Rate limited, retry in ${error.retryAfter}s`);
          } else {
            console.warn('[HistorySync] Failed to fetch AniList list:', error);
          }
          return;
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
          if (isAnimeAniListSyncDisabled(animeId)) continue;

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
        console.log('[HistorySync] Successfully synced AniList history to local storage (1 request)');
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