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
  const { isLoggedIn, saveEntry, getUserMediaState } = useAuth();
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
        console.warn('[MangaSync] syncBookmarkToAniList: not logged in');
        return;
      }

      if (!saveEntry) {
        console.warn('[MangaSync] syncBookmarkToAniList: saveEntry not available');
        return;
      }

      try {
        const id = parseInt(mangaId, 10);
        if (Number.isNaN(id)) {
          console.warn('[MangaSync] syncBookmarkToAniList: invalid manga ID:', mangaId);
          return;
        }

        console.log(`[MangaSync] syncBookmarkToAniList START: manga ${mangaId}`);

        const existing = await getUserMediaState(id);
        if (existing?.entry) {
          lastSyncRef.current[mangaId] = { syncedAt: Date.now() };
          console.log(`[MangaSync] Skipped ${mangaId} — already on AniList (${existing.entry.status})`);
          return;
        }

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
          console.log(`[MangaSync] ✅ SYNCED: manga ${mangaId} → status: ${result.status}`);
        } else {
          console.error(`[MangaSync] ❌ FAILED: saveEntry returned null for manga ${mangaId}`);
        }
      } catch (err) {
        console.error(`[MangaSync] ❌ ERROR in syncBookmarkToAniList (manga ${mangaId}):`, err instanceof Error ? err.message : err);
      }
    },
    [isLoggedIn, saveEntry, getUserMediaState],
  );

  /**
   * Syncs all local bookmarks to AniList.
   */
  /**
   * Syncs all local bookmarks to AniList.
   */
  const syncAllBookmarks = useCallback(async () => {
    if (!isLoggedIn) {
      console.log('[MangaSync] syncAllBookmarks: skipped (not logged in)');
      return;
    }

    if (!settings.aniListSync) {
      console.log('[MangaSync] syncAllBookmarks: skipped (autosync disabled)');
      return;
    }

    const bookmarks = getMangaBookmarks();
    const bookmarkIds = Object.keys(bookmarks);

    console.log(`[MangaSync] syncAllBookmarks START: ${bookmarkIds.length} bookmarks`);

    if (bookmarkIds.length === 0) {
      console.log('[MangaSync] syncAllBookmarks: no bookmarks to sync');
      return;
    }

    let synced = 0;
    let failed = 0;

    // Sync each bookmark sequentially to avoid rate limiting
    for (const mangaId of bookmarkIds) {
      try {
        await syncBookmarkToAniList(mangaId);
        synced++;
      } catch (err) {
        failed++;
        console.error(`[MangaSync] syncAllBookmarks: error syncing ${mangaId}:`, err);
      }
      // Small delay between requests to be respectful to the API
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    console.log(`[MangaSync] syncAllBookmarks COMPLETE: ${synced}/${bookmarkIds.length} synced, ${failed} failed`);
  }, [isLoggedIn, settings.aniListSync, syncBookmarkToAniList]);

  /**
   * Handle bookmark changes (when user bookmarks a new manga)
   */
  const handleBookmarkChanged = useCallback(() => {
    if (!isLoggedIn) {
      console.log('[MangaSync] handleBookmarkChanged: skipped (not logged in)');
      return;
    }
    if (!settings.aniListSync) {
      console.log('[MangaSync] handleBookmarkChanged: skipped (autosync disabled)');
      return;
    }

    // Find newly bookmarked manga and sync them
    const bookmarks = getMangaBookmarks();
    const newBookmarks = Object.keys(bookmarks).filter((mangaId) => !lastSyncRef.current[mangaId]);
    
    if (newBookmarks.length === 0) {
      console.log('[MangaSync] handleBookmarkChanged: no new bookmarks to sync');
      return;
    }

    console.log(`[MangaSync] handleBookmarkChanged: syncing ${newBookmarks.length} new bookmarks`);
    for (const mangaId of newBookmarks) {
      void syncBookmarkToAniList(mangaId);
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
