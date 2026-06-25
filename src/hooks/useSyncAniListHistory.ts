/**
 * useSyncAniListHistory.ts
 *
 * On login or app startup, pulls user's AniList watch history and populates
 * local storage so they see their history on new devices when they login.
 *
 * Fetches:
 * - User's anime list with current progress across all statuses
 * - Updates local watched-episodes tracking
 * - Updates last-anime-visited metadata
 */

import { useEffect, useRef } from 'react';
import { useAuth } from '../client/useAuth';
import { fetchUserList } from '../client/authService';
import { safeLocalStorageSet } from '../lib/safeStorage';

const HISTORY_SYNCED_KEY = 'anilist-history-synced';

interface SyncMeta {
  lastSyncAt: number;
}

/**
 * Hook to pull AniList anime history on login.
 * When user logs in, fetches their AniList list and syncs to local storage
 * so they see their history on new devices.
 */
export function useSyncAniListHistory() {
  const { isLoggedIn, userData } = useAuth();
  const hasSyncedRef = useRef(false);

  useEffect(() => {
    if (!isLoggedIn || !userData?.name) {
      hasSyncedRef.current = false;
      return;
    }

    // Only sync once per session (unless user logs out and back in)
    if (hasSyncedRef.current) {
      return;
    }

    let cancelled = false;

    const syncHistory = async () => {
      try {
        // Get auth token from localStorage
        const token = localStorage.getItem('accessToken');
        if (!token) {
          console.warn('[HistorySync] No auth token available');
          return;
        }

        const username = userData.name;
        const statuses: Array<'CURRENT' | 'PLANNING' | 'COMPLETED' | 'PAUSED' | 'DROPPED' | 'REPEATING'> = [
          'CURRENT', 'PLANNING', 'COMPLETED', 'PAUSED', 'DROPPED', 'REPEATING',
        ];

        // Fetch anime list entries from all statuses
        const allEntries = [];
        for (const status of statuses) {
          if (cancelled) return;
          try {
            const entries = await fetchUserList(token, username, 'ANIME', status);
            allEntries.push(...entries);
          } catch (error) {
            console.warn(`[HistorySync] Failed to fetch ${status} list:`, error);
          }
          // Rate limit requests
          await new Promise((resolve) => setTimeout(resolve, 200));
        }

        if (cancelled || allEntries.length === 0) {
          return;
        }

        // Get current local data
        const localWatchedEpisodes: Record<string, unknown> = (() => {
          try {
            const data = localStorage.getItem('watched-episodes');
            return data ? JSON.parse(data) : {};
          } catch {
            return {};
          }
        })();

        const localLastVisited: Record<string, any> = (() => {
          try {
            const data = localStorage.getItem('last-anime-visited');
            return data ? JSON.parse(data) : {};
          } catch {
            return {};
          }
        })();

        /**
         * Read the local watched-episode count for an anime regardless of the
         * stored shape (Episode[] | number | { number }[]).
         */
        const localCountFor = (animeId: string): number => {
          const v = localWatchedEpisodes[animeId];
          if (typeof v === 'number') return v;
          if (Array.isArray(v)) {
            let max = 0;
            for (const ep of v) {
              if (typeof ep === 'number') max = Math.max(max, ep);
              else if (ep && typeof ep === 'object' && 'number' in ep) {
                const n = Number((ep as any).number);
                if (!Number.isNaN(n)) max = Math.max(max, n);
              }
            }
            return max || v.length;
          }
          return 0;
        };

        // Merge AniList data with local data (AniList takes precedence for progress)
        let historyChanged = false;
        let visitedChanged = false;
        for (const entry of allEntries) {
          const animeId = entry.media?.id?.toString();

          if (!animeId) continue;

          // Skip entries with invalid media data
          if (!entry.media?.title?.romaji && !entry.media?.title?.english) {
            console.warn(`[HistorySync] Skipping entry ${animeId} with invalid title`);
            continue;
          }

          const anilistProgress = entry.progress || 0;

          // Only update local progress if AniList is ahead. CRITICAL: we must
          // not overwrite the rich Episode[] history with a bare number — if
          // the app stores an array, we leave it intact and let the player's
          // normal watch tracking catch up. When the local value is a bare
          // number (or missing), we can safely set it.
          const localProgress = localCountFor(animeId);
          if (anilistProgress > localProgress) {
            const current = localWatchedEpisodes[animeId];
            if (Array.isArray(current)) {
              // Preserve the array shape; the player reconciles real episodes
              // as the user re-watches. We don't fabricate episode objects.
            } else if (typeof current === 'number' || current === undefined) {
              localWatchedEpisodes[animeId] = anilistProgress;
              historyChanged = true;
            }
          }

          // Update / enrich metadata. We merge rather than replace so we never
          // drop fields like totalEpisodes that other code has written.
          const existing = localLastVisited[animeId] || {};
          const merged = {
            ...existing,
            timestamp: existing.timestamp ?? Date.now(),
            titleEnglish:
              existing.titleEnglish ||
              entry.media?.title?.english ||
              entry.media?.title?.romaji ||
              'Unknown',
            titleRomaji:
              existing.titleRomaji ||
              entry.media?.title?.romaji ||
              entry.media?.title?.english ||
              'Unknown',
            status: entry.status ?? existing.status,
            totalEpisodes:
              entry.media?.episodes !== undefined && entry.media.episodes !== null
                ? entry.media.episodes
                : existing.totalEpisodes ?? null,
          };
          if (JSON.stringify(merged) !== JSON.stringify(existing)) {
            localLastVisited[animeId] = merged;
            visitedChanged = true;
          }
        }

        // Save synced data back to localStorage (only if something changed).
        // Use the quota-safe setter so a large history list can never throw an
        // uncaught QuotaExceededError on login sync.
        if (historyChanged) {
          safeLocalStorageSet('watched-episodes', JSON.stringify(localWatchedEpisodes));
        }
        if (visitedChanged) {
          safeLocalStorageSet('last-anime-visited', JSON.stringify(localLastVisited));
        }

        // Notify same-tab listeners (History page, EpisodeCard) that watch
        // data may have changed — the native `storage` event only fires
        // cross-tab, so they wouldn't otherwise refresh.
        if (historyChanged) {
          try { window.dispatchEvent(new Event('storage')); } catch { /* non-browser */ }
        }

        // Mark as synced
        const syncMeta: SyncMeta = {
          lastSyncAt: Date.now(),
        };
        localStorage.setItem(HISTORY_SYNCED_KEY, JSON.stringify(syncMeta));

        hasSyncedRef.current = true;

        console.log('[HistorySync] Successfully synced AniList history to local storage');
      } catch (error) {
        console.error('[HistorySync] Failed to sync AniList history:', error);
      }
    };

    syncHistory();

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, userData?.name]);
}
