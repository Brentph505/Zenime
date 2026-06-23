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
        const localWatchedEpisodes: Record<string, number> = (() => {
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

        // Merge AniList data with local data (AniList takes precedence for progress)
        for (const entry of allEntries) {
          const animeId = entry.media?.id?.toString();

          if (!animeId) continue;

          // Skip entries with invalid media data
          if (!entry.media?.title?.romaji && !entry.media?.title?.english) {
            console.warn(`[HistorySync] Skipping entry ${animeId} with invalid title`);
            continue;
          }

          // Update progress from AniList if it has more progress than local
          const localProgress = localWatchedEpisodes[animeId] || 0;
          const anilistProgress = entry.progress || 0;

          if (anilistProgress > localProgress) {
            localWatchedEpisodes[animeId] = anilistProgress;
          }

          // Update metadata if not already set locally
          if (!localLastVisited[animeId]) {
            localLastVisited[animeId] = {
              timestamp: Date.now(),
              titleEnglish: entry.media?.title?.english || entry.media?.title?.romaji || 'Unknown',
              titleRomaji: entry.media?.title?.romaji || entry.media?.title?.english || 'Unknown',
              status: entry.status,
              totalEpisodes: entry.media?.episodes || null,
            };
          } else {
            // Update metadata with AniList data
            localLastVisited[animeId] = {
              ...localLastVisited[animeId],
              status: entry.status,
              totalEpisodes: entry.media?.episodes !== undefined ? entry.media.episodes : localLastVisited[animeId].totalEpisodes,
            };
          }
        }

        // Save synced data back to localStorage
        localStorage.setItem('watched-episodes', JSON.stringify(localWatchedEpisodes));
        localStorage.setItem('last-anime-visited', JSON.stringify(localLastVisited));

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
