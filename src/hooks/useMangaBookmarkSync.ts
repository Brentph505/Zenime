/**
 * useMangaBookmarkSync.ts
 *
 * Syncs local manga bookmarks to AniList's manga list when:
 * 1. User is logged in
 * 2. autosync is enabled
 * 3. Synced manga will be added to user's list with "PLANNING" status if not already there
 */

import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../client/useAuth';
import { useSettings } from '../components/Profile/SettingsProvider';
import { getMangaBookmarks } from '../lib/mangaHistory';
import { MANGA_BOOKMARKS_CHANGED_EVENT } from '../lib/mangaHistory';

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // Sync every 5 minutes
const BOOKMARKS_SYNCED_KEY = 'manga-bookmarks-synced';

interface SyncedBookmark {
  [mangaId: string]: {
    syncedAt: number;
  };
}

/**
 * Hook to auto-sync local manga bookmarks to AniList.
 * When autosync is enabled and user is logged in, periodically syncs
 * all bookmarked manga to the user's AniList list.
 */
export function useMangaBookmarkSync() {
  const { isLoggedIn, saveEntry } = useAuth();
  const { settings } = useSettings();
  const syncIntervalRef = useRef<NodeJS.Timeout>();
  const lastSyncRef = useRef<SyncedBookmark>((() => {
    try {
      const stored = localStorage.getItem(BOOKMARKS_SYNCED_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  })());

  /**
   * Syncs a single manga bookmark to AniList.
   * Adds/updates the manga in the user's list with PLANNING status if not already tracked.
   */
  const syncBookmarkToAniList = useCallback(
    async (mangaId: string) => {
      if (!isLoggedIn) {
        console.warn('[MangaSync] Cannot sync: not logged in');
        return;
      }

      if (!saveEntry) {
        console.warn('[MangaSync] Cannot sync: saveEntry not available');
        return;
      }

      try {
        const id = parseInt(mangaId, 10);
        if (Number.isNaN(id)) {
          console.warn('[MangaSync] Invalid manga ID:', mangaId);
          return;
        }

        console.log(`[MangaSync] Attempting to sync manga ${mangaId} to AniList...`);

        // Save to AniList with PLANNING status
        const result = await saveEntry({
          mediaId: id,
          status: 'PLANNING',
          notes: 'Bookmarked from Zenime',
        });

        if (result) {
          // Update sync tracking
          lastSyncRef.current[mangaId] = { syncedAt: Date.now() };
          localStorage.setItem(
            BOOKMARKS_SYNCED_KEY,
            JSON.stringify(lastSyncRef.current),
          );
          console.log(`[MangaSync] ✅ Successfully synced bookmark for manga ${mangaId} to AniList`);
        } else {
          console.error(`[MangaSync] ❌ saveEntry returned null for manga ${mangaId}`);
        }
      } catch (err) {
        console.error(`[MangaSync] ❌ Failed to sync manga ${mangaId}:`, err);
      }
    },
    [isLoggedIn, saveEntry],
  );

  /**
   * Syncs all local bookmarks to AniList.
   */
  const syncAllBookmarks = useCallback(async () => {
    if (!isLoggedIn) {
      console.log('[MangaSync] Skipping sync: not logged in');
      return;
    }

    if (!settings.aniListSync) {
      console.log('[MangaSync] Skipping sync: autosync disabled');
      return;
    }

    const bookmarks = getMangaBookmarks();
    const bookmarkIds = Object.keys(bookmarks);

    console.log(`[MangaSync] Starting sync of ${bookmarkIds.length} bookmarks`, bookmarkIds);

    if (bookmarkIds.length === 0) {
      console.log('[MangaSync] No bookmarks to sync');
      return;
    }

    // Sync each bookmark sequentially to avoid rate limiting
    for (const mangaId of bookmarkIds) {
      await syncBookmarkToAniList(mangaId);
      // Small delay between requests to be respectful to the API
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    console.log('[MangaSync] Bookmark sync complete');
  }, [isLoggedIn, settings.aniListSync, syncBookmarkToAniList]);

  /**
   * Handle bookmark changes (when user bookmarks a new manga)
   */
  const handleBookmarkChanged = useCallback(() => {
    if (!isLoggedIn || !settings.aniListSync) return;

    // Find newly bookmarked manga and sync them
    const bookmarks = getMangaBookmarks();
    for (const mangaId of Object.keys(bookmarks)) {
      if (!lastSyncRef.current[mangaId]) {
        void syncBookmarkToAniList(mangaId);
      }
    }
  }, [isLoggedIn, settings.aniListSync, syncBookmarkToAniList]);

  /**
   * Set up periodic sync and event listeners
   */
  useEffect(() => {
    // Don't sync if not logged in or autosync disabled
    if (!isLoggedIn || !settings.aniListSync) {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = undefined;
      }
      return;
    }

    // Listen for bookmark changes
    window.addEventListener(MANGA_BOOKMARKS_CHANGED_EVENT, handleBookmarkChanged);

    // Set up periodic sync
    syncIntervalRef.current = setInterval(() => {
      void syncAllBookmarks();
    }, SYNC_INTERVAL_MS);

    // Initial sync
    void syncAllBookmarks();

    return () => {
      window.removeEventListener(MANGA_BOOKMARKS_CHANGED_EVENT, handleBookmarkChanged);
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, settings.aniListSync]);

  return {
    syncBookmarkToAniList,
    syncAllBookmarks,
  };
}

export default useMangaBookmarkSync;
