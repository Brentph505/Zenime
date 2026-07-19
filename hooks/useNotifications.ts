/**
 * useNotifications.ts
 *
 * Lazy, paginated fetcher for the signed-in viewer's AniList notifications.
 *
 * Design:
 *  - Fetches only when `load()` is first called (i.e. when the user opens the
 *    panel), so users who never open it pay no network cost.
 *  - Caches the first page for the lifetime of the component; "Load more"
 *    appends subsequent pages.
 *  - Clears the in-app unread badge via `markNotificationsRead()` on a
 *    successful first load (AniList's resetNotificationCount:false leaves the
 *    server count alone; we only reflect "seen" locally).
 */

import { useCallback, useRef, useState } from 'react';
import { fetchNotifications, type AniListNotification } from '../client/authService';

interface NotificationItem extends AniListNotification {
  read: boolean;
}

interface UseNotificationsState {
  items: NotificationItem[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasNextPage: boolean;
  /** True once any load (success or fail) has completed at least once. */
  loaded: boolean;
}

const INITIAL: UseNotificationsState = {
  items: [],
  loading: false,
  loadingMore: false,
  error: null,
  hasNextPage: false,
  loaded: false,
};

export function useNotifications(
  isLoggedIn: boolean,
  getToken: () => string | null,
  markRead: () => void,
) {
  const [state, setState] = useState<UseNotificationsState>(INITIAL);
  const fetchedRef = useRef(false);

  const load = useCallback(async () => {
    // Already loaded (or in flight) — caller can open the panel immediately.
    if (fetchedRef.current) return;
    if (!isLoggedIn) return;

    const token = getToken();
    if (!token) return;

    fetchedRef.current = true;
    setState((s) => ({ ...s, loading: true, error: null }));

    try {
      // FIX: pass `resetNotificationCount: true` so AniList's real unread
      // counter is cleared here, not just our local React state. Previously
      // this always sent `false`, so markRead() zeroed the badge for a
      // moment but the next 5-minute poll (fetchNotificationCount) fetched
      // the unchanged server count and the badge popped right back.
      const { items, hasNextPage } = await fetchNotifications(token, 1, 25, true);
      setState({
        items: items.map((item) => ({ ...item, read: false })),
        loading: false,
        loadingMore: false,
        error: null,
        hasNextPage,
        loaded: true,
      });
      // Clear the navbar badge now that the user has seen the list.
      markRead();
    } catch (err) {
      fetchedRef.current = false; // allow retry
      setState((s) => ({
        ...s,
        loading: false,
        loaded: true,
        error: err instanceof Error ? err.message : 'Failed to load notifications',
      }));
    }
  }, [isLoggedIn, getToken, markRead]);

  const markAllRead = useCallback(() => {
    setState((s) => ({
      ...s,
      items: s.items.map((item) => ({ ...item, read: true })),
    }));
    markRead();
  }, [markRead]);

  const markItemRead = useCallback((id: number) => {
    setState((s) => ({
      ...s,
      items: s.items.map((item) => (item.id === id ? { ...item, read: true } : item)),
    }));
  }, []);

  const loadMore = useCallback(async () => {
    if (!isLoggedIn || state.loadingMore || !state.hasNextPage) return;
    const token = getToken();
    if (!token) return;

    const nextPage = Math.floor(state.items.length / 25) + 1;
    setState((s) => ({ ...s, loadingMore: true }));

    try {
      const { items, hasNextPage } = await fetchNotifications(token, nextPage, 25);
      setState((s) => ({
        ...s,
        items: [...s.items, ...items.map((item) => ({ ...item, read: false }))],
        loadingMore: false,
        hasNextPage,
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        loadingMore: false,
        error: err instanceof Error ? err.message : 'Failed to load more',
      }));
    }
  }, [isLoggedIn, state.loadingMore, state.hasNextPage, state.items.length, getToken]);

  const refresh = useCallback(async () => {
    fetchedRef.current = false;
    await load();
  }, [load]);

  return { ...state, load, loadMore, refresh, markAllRead, markItemRead };
}