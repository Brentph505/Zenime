/**
 * AnimeSyncActivator.tsx
 *
 * Activates anime and manga syncing with AniList.
 * - Syncs watched episodes to AniList when autosync is enabled
 * - Pulls AniList history on login to restore watch history on new devices
 * - Syncs manga bookmarks to AniList when autosync is enabled
 * This component should be placed within the SettingsProvider and AuthProvider context.
 */

import { useMangaBookmarkSync } from '../hooks/useMangaBookmarkSync';
// import { useAnimeProgressSync } from '../hooks/useAnimeProgressSync';
// import { useSyncAniListHistory } from '../hooks/useSyncAniListHistory';

export function MangaSyncActivator() {
  // Activate manga bookmark sync (anime sync disabled temporarily due to crash)
  useMangaBookmarkSync();
  
  // This component doesn't render anything
  return null;
}

export default MangaSyncActivator;
