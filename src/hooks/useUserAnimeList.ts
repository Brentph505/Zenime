import { useCallback, useEffect, useState } from 'react';
import {
  fetchUserMediaList,
  type AnimeListEntry,
  type MediaListStatus,
} from '../client/authService';

export function useUserMediaList(
  username?: string,
  status: MediaListStatus = 'CURRENT',
  mediaType: 'ANIME' | 'MANGA' = 'ANIME',
) {
  const [entries, setEntries] = useState<AnimeListEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!username) {
      setEntries([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetchUserMediaList(username, status, mediaType);
      setEntries(result);
    } catch (err) {
      setEntries([]);
      setError(err instanceof Error ? err.message : `Failed to load ${mediaType.toLowerCase()} list`);
    } finally {
      setLoading(false);
    }
  }, [username, status, mediaType]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { entries, loading, error, refresh };
}

export function useUserAnimeList(
  username?: string,
  status: MediaListStatus = 'CURRENT',
) {
  return useUserMediaList(username, status, 'ANIME');
}
