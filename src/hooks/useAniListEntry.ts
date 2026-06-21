/**
 * useAniListEntry.ts
 *
 * Loads the signed-in viewer's relationship to a single AniList media item
 * (their MediaList entry + favourite flag) and exposes optimistic mutation
 * helpers: change status, set score, toggle favourite.
 *
 * All mutations go through the existing `useAuth()` actions (saveEntry /
 * toggleFav) so the token + cache logic stays in one place.
 *
 * Reliability notes:
 *  - Every mutation captures the current state BEFORE optimistically updating,
 *    so a failed save can roll the UI back to what the server last confirmed.
 *  - `saveEntry`/`toggleFav` resolve to `null`/`false` on auth or network
 *    failure; we treat that as a failed mutation and revert.
 *  - When AniList returns the updated entry, we sync from it (authoritative).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../client/useAuth';
import type { MediaListStatus } from '../client/authService';

/**
 * Custom event dispatched whenever a list mutation succeeds, so other views
 * that read AniList list data (Profile stats, WatchingAnilist) can refresh
 * without polling. The native `storage` event only fires cross-tab.
 */
export const ANILIST_ENTRY_CHANGED_EVENT = 'anilist-entry-changed';

const dispatchEntryChanged = () => {
  try { window.dispatchEvent(new CustomEvent(ANILIST_ENTRY_CHANGED_EVENT)); }
  catch { /* non-browser */ }
};

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

  // Latest-state mirror so async mutation callbacks always read fresh values
  // (avoids stale-closure bugs and the previous out-of-scope `s` reference).
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

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
      if (!mediaId) return false;
      const prev = stateRef.current;
      setState((s) => ({ ...s, inList: true, status, saving: true }));

      try {
        const result = await saveEntry({ mediaId, status });
        if (!result) {
          // Save failed — roll back to the last confirmed state.
          setState((s) => ({ ...s, status: prev.status, inList: prev.inList, saving: false }));
          console.warn('[useAniListEntry] setStatus failed, reverted');
          return false;
        }
        // Sync from the authoritative returned entry.
        setState((s) => ({
          ...s,
          inList: true,
          status: result.status ?? status,
          score: result.score ?? s.score,
          progress: result.progress ?? s.progress,
          saving: false,
        }));
        dispatchEntryChanged();
        return true;
      } catch {
        setState((s) => ({ ...s, status: prev.status, inList: prev.inList, saving: false }));
        return false;
      }
    },
    [mediaId, saveEntry],
  );

  // ── setScore ────────────────────────────────────────────────────────────────
  // AniList stores scores on a 0–100 scale internally regardless of the user's
  // display format, so we always send the raw point value.
  const setScore = useCallback(
    async (score: number) => {
      if (!mediaId) return false;
      const prev = stateRef.current;
      setState((s) => ({ ...s, score, inList: true, saving: true }));

      try {
        // Preserve the existing status (AniList requires an entry to hold a
        // score; sending status keeps it on the right list).
        const result = await saveEntry({
          mediaId,
          score,
          status: prev.status ?? undefined,
        });
        if (!result) {
          setState((s) => ({ ...s, score: prev.score, inList: prev.inList, saving: false }));
          console.warn('[useAniListEntry] setScore failed, reverted');
          return false;
        }
        setState((s) => ({
          ...s,
          inList: true,
          score: result.score ?? score,
          status: result.status ?? s.status,
          progress: result.progress ?? s.progress,
          saving: false,
        }));
        dispatchEntryChanged();
        return true;
      } catch {
        setState((s) => ({ ...s, score: prev.score, inList: prev.inList, saving: false }));
        return false;
      }
    },
    [mediaId, saveEntry],
  );

  // ── toggleFavourite ─────────────────────────────────────────────────────────
  const toggleFavourite = useCallback(
    async (type: 'ANIME' | 'MANGA' = 'ANIME') => {
      if (!mediaId) return false;
      const prev = stateRef.current;
      const nextFav = !prev.isFavourite;
      setState((s) => ({ ...s, isFavourite: nextFav, saving: true }));

      try {
        const key = type === 'MANGA' ? 'mangaId' : 'animeId';
        const ok = await toggleFav({ [key]: mediaId } as {
          animeId?: number; mangaId?: number;
        });
        if (!ok) {
          // Toggle failed — revert the heart.
          setState((s) => ({ ...s, isFavourite: prev.isFavourite, saving: false }));
          console.warn('[useAniListEntry] toggleFavourite failed, reverted');
          return false;
        }
        setState((s) => ({ ...s, isFavourite: nextFav, saving: false }));
        return true;
      } catch {
        setState((s) => ({ ...s, isFavourite: prev.isFavourite, saving: false }));
        return false;
      }
    },
    [mediaId, toggleFav],
  );

  return { ...state, setStatus, setScore, toggleFavourite };
}
