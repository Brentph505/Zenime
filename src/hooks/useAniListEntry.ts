/**
 * useAniListEntry.ts
 *
 * Loads the signed-in viewer's relationship to a single AniList media item
 * (their MediaList entry + favourite flag) and exposes optimistic mutation
 * helpers: change status, set score, toggle favourite.
 *
 * All mutations go through the existing `useAuth()` actions (saveEntry /
 * toggleFav) so the token + cache logic stays in one place.
 */

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../client/useAuth';
import type { MediaListStatus } from '../client/authService';

export interface AniListEntryState {
  /** Loading the initial state. */
  loading: boolean;
  /** True when the viewer has any list entry for this media. */
  inList: boolean;
  status: MediaListStatus | null;
  score: number;
  progress: number;
  isFavourite: boolean;
  /** A mutation is currently in flight (for button spinners). */
  saving: boolean;
}

const IDLE: AniListEntryState = {
  loading: true,
  inList: false,
  status: null,
  score: 0,
  progress: 0,
  isFavourite: false,
  saving: false,
};

export function useAniListEntry(
  mediaId: number | null | undefined,
  enabled: boolean = true,
) {
  const { isLoggedIn, getUserMediaState, saveEntry, toggleFav } = useAuth();
  const [state, setState] = useState<AniListEntryState>(IDLE);

  // ── Load ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || !isLoggedIn || !mediaId || Number.isNaN(mediaId)) {
      setState({ ...IDLE, loading: false });
      return;
    }

    let cancelled = false;
    setState({ ...IDLE, loading: true });

    getUserMediaState(mediaId)
      .then((data) => {
        if (cancelled) return;
        const entry = data?.entry ?? null;
        setState({
          loading: false,
          inList: !!entry,
          status: entry?.status ?? null,
          score: entry?.score ?? 0,
          progress: entry?.progress ?? 0,
          isFavourite: data?.isFavourite ?? false,
          saving: false,
        });
      })
      .catch(() => {
        if (!cancelled) setState({ ...IDLE, loading: false });
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaId, isLoggedIn, enabled]);

  // ── setStatus ───────────────────────────────────────────────────────────────
  const setStatus = useCallback(
    async (status: MediaListStatus) => {
      if (!mediaId) return;
      setState((s) => ({ ...s, inList: true, status, saving: true }));
      await saveEntry({ mediaId, status });
      setState((s) => ({ ...s, saving: false }));
    },
    [mediaId, saveEntry],
  );

  // ── setScore ────────────────────────────────────────────────────────────────
  // AniList stores scores on a 0–100 scale internally regardless of the user's
  // display format, so we always send the raw point value.
  const setScore = useCallback(
    async (score: number) => {
      if (!mediaId) return;
      setState((s) => ({ ...s, score, saving: true }));
      // Adding a score implicitly creates / keeps the entry on the list.
      await saveEntry({ mediaId, score, status: s?.status ?? undefined });
      setState((s) => ({ ...s, saving: false }));
    },
    [mediaId, saveEntry],
  );

  // ── toggleFavourite ─────────────────────────────────────────────────────────
  const toggleFavourite = useCallback(
    async (type: 'ANIME' | 'MANGA' = 'ANIME') => {
      if (!mediaId) return;
      setState((s) => ({ ...s, isFavourite: !s.isFavourite, saving: true }));
      const key = type === 'MANGA' ? 'mangaId' : 'animeId';
      await toggleFav({ [key]: mediaId } as {
        animeId?: number; mangaId?: number;
      });
      setState((s) => ({ ...s, saving: false }));
    },
    [mediaId, toggleFav],
  );

  return { ...state, setStatus, setScore, toggleFavourite };
}
