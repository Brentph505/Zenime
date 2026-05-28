import { useCallback, useEffect, useState } from 'react';
import {
  fetchUserAnimeList,
  type AnimeListEntry,
  type MediaListStatus,
} from '../client/authService';

export function useUserAnimeList(
  username?: string,
  status: MediaListStatus = 'CURRENT',
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
      const result = await fetchUserAnimeList(username, status);
      setEntries(result);
    } catch (err) {
      setEntries([]);
      setError(err instanceof Error ? err.message : 'Failed to load anime list');
    } finally {
      setLoading(false);
    }
  }, [username, status]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { entries, loading, error, refresh };
}
