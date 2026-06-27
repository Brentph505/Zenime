/**
 * useAuth.tsx
 *
 * Stable, feature-rich authentication context for AniList OAuth.
 *
 * Features:
 *  - Instant UI restore from cache on every page refresh (no blank flash)
 *  - Background token re-validation (non-blocking, 5-min window)
 *  - Exponential back-off retries for transient network errors
 *  - Full AniList list management: add, update, delete, toggle favourite
 *  - Unread notification count, polled every 5 min while logged in
 *  - Per-media progress tracking via updateProgress helper
 *  - Safe unmount guard (no state updates after unmount)
 *  - Single source of truth for all AniList mutations
 *
 * ── BUG FIX (refresh wipes login) ────────────────────────────────────────────
 *  Previously, React state was initialised to `isLoggedIn: false` and
 *  `userData: null`, then a useEffect read localStorage and corrected it.
 *  Between the first render and the effect, the Provider briefly returned
 *  `null` (via `if (authLoading) return null`), unmounting the entire child
 *  tree and flickering a logged-out state.
 *
 *  Fix: use React lazy-initialiser functions so `isLoggedIn` and `userData`
 *  are read from localStorage SYNCHRONOUSLY before the first render.
 *  `authLoading` and the `return null` guard have been removed entirely —
 *  the Provider always renders children with the correct initial state.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
} from 'react';
import { UserData } from './userInfoTypes';
import {
  fetchUserData,
  buildAuthUrl,
  saveMediaListEntry,
  deleteMediaListEntry,
  toggleFavourite,
  fetchMediaListEntry,
  fetchUserMediaState,
  fetchNotificationCount,
  type MediaListStatus,
  type SaveEntryInput,
  type UserMediaState,
} from './authService';

// ─── Re-export so callers don't need to import authService directly ──────────
export type { MediaListStatus, SaveEntryInput, UserMediaState };

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MediaListEntry {
  id: number;
  status: MediaListStatus;
  score: number;
  progress: number;
  progressVolumes: number | null;
  repeat: number;
  private: boolean;
  notes: string | null;
  startedAt: { year: number | null; month: number | null; day: number | null };
  completedAt: { year: number | null; month: number | null; day: number | null };
  updatedAt: number;
  media: {
    id: number;
    title: { romaji: string; english: string | null };
    episodes: number | null;
    chapters: number | null;
    type: 'ANIME' | 'MANGA';
    coverImage?: { large?: string; medium?: string } | null;
  };
}

export interface AuthContextType {
  // State
  isLoggedIn: boolean;
  userData: UserData | null;
  username: string | null;
  isValidatingToken: boolean;
  unreadNotifications: number;
  /** Clear the unread-notification badge locally after the user views them. */
  markNotificationsRead: () => void;

  // Auth
  login: () => void;
  logout: () => void;
  refreshUserData: () => Promise<void>;

  // List management
  saveEntry: (input: SaveEntryInput) => Promise<MediaListEntry | null>;
  deleteEntry: (listEntryId: number) => Promise<boolean>;
  toggleFav: (params: {
    animeId?: number;
    mangaId?: number;
    characterId?: number;
    staffId?: number;
    studioId?: number;
  }) => Promise<boolean>;
  getListEntry: (mediaId: number) => Promise<MediaListEntry | null>;
  /** Fetch the viewer's list entry + favourite flag for a single media item. */
  getUserMediaState: (mediaId: number) => Promise<UserMediaState | null>;
  updateProgress: (
    mediaId: number,
    progress: number,
    status?: MediaListStatus,
  ) => Promise<MediaListEntry | null>;
}

// ─── Storage keys ─────────────────────────────────────────────────────────────

const KEYS = {
  TOKEN: 'accessToken',
  CACHE: 'zenime_userData',
  LAST_VALIDATED: 'zenime_lastValidation',
} as const;

const REVALIDATE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// ─── Cache helpers ────────────────────────────────────────────────────────────

function storeCache(data: UserData): void {
  try {
    localStorage.setItem(KEYS.CACHE, JSON.stringify({ data, ts: Date.now() }));
  } catch { /* storage unavailable */ }
}

function isProbablyUserData(value: unknown): value is UserData {
  return !!value && typeof value === 'object' && (
    'name' in value || 'avatar' in value || 'statistics' in value
  );
}

function loadCache(): UserData | null {
  try {
    const raw = localStorage.getItem(KEYS.CACHE);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (isProbablyUserData(p?.data)) return p.data as UserData;      // new shape: {data, ts}
    if (isProbablyUserData(p))        return p as UserData;           // legacy bare UserData
    // Also support old key written by previous code
    const legacy = localStorage.getItem('userData');
    if (legacy) {
      const lp = JSON.parse(legacy);
      if (isProbablyUserData(lp?.data)) return lp.data as UserData;
      if (isProbablyUserData(lp))        return lp as UserData;
    }
    return null;
  } catch { return null; }
}

function clearSession(): void {
  try {
    [KEYS.TOKEN, KEYS.CACHE, KEYS.LAST_VALIDATED,
     'userData', 'lastTokenValidation'].forEach(k => localStorage.removeItem(k));
  } catch { /* ignore */ }
}

function getToken(): string | null {
  try { return localStorage.getItem(KEYS.TOKEN); } catch { return null; }
}

function isValidToken(t: string | null): t is string {
  return typeof t === 'string' && t.trim().length > 10 &&
    t !== 'undefined' && t !== 'null';
}

function needsRevalidation(): boolean {
  try {
    const last = localStorage.getItem(KEYS.LAST_VALIDATED);
    return !last || Date.now() - parseInt(last, 10) > REVALIDATE_INTERVAL_MS;
  } catch { return true; }
}

function stampValidation(): void {
  try { localStorage.setItem(KEYS.LAST_VALIDATED, Date.now().toString()); }
  catch { /* ignore */ }
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  /**
   * FIX: Lazy initialisers run synchronously before the first render.
   *
   * Previously these were `useState(false)` / `useState(null)`, so the first
   * render always saw a logged-out state and the Provider returned `null` while
   * waiting for a useEffect to read localStorage.  That caused a full unmount
   * of children (blank page / logged-out flash) on every hard refresh.
   *
   * Now `isLoggedIn` and `userData` are correct from frame 1 — no flicker,
   * no blank page, no "logged-out" flash.
   */
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    const token = getToken();
    return isValidToken(token) && !!loadCache();
  });

  const [userData, setUserData] = useState<UserData | null>(loadCache);

  const [isValidatingToken, setIsValidatingToken] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  // Guard against state updates after unmount
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  // ── Token validation (with retry) ─────────────────────────────────────────

  const validateToken = useCallback(async (token: string, attempt = 0): Promise<void> => {
    if (!mounted.current) return;

    if (attempt === 0) setIsValidatingToken(true);

    try {
      const data = await fetchUserData(token);
      if (!mounted.current) return;

      setUserData(data);
      setIsLoggedIn(true);
      setIsValidatingToken(false);
      storeCache(data);
      stampValidation();
      console.log('[Auth] ✅ Token valid, user:', data.name);

    } catch (err: any) {
      if (!mounted.current) return;

      const status: number | undefined = err?.response?.status;
      const isHardAuthError = status === 401 || status === 403;
      const isNetworkError  = !err?.response;

      if (!isHardAuthError && attempt < 3) {
        // Transient failure → exponential back-off retry
        const delay = isNetworkError
          ? Math.min(2000 * 2 ** attempt, 16_000)
          : 1000;
        console.warn(`[Auth] ⚠️ Validation failed (attempt ${attempt + 1}), retrying in ${delay}ms…`);
        setTimeout(() => validateToken(token, attempt + 1), delay);
        return; // keep isValidatingToken true while retrying
      }

      // Hard auth error or exhausted retries
      if (isHardAuthError) {
        const cached = loadCache();
        if (!cached) {
          console.warn('[Auth] ❌ Token rejected, no cache — clearing session');
          clearSession();
          setIsLoggedIn(false);
          setUserData(null);
        } else {
          // Preserve user experience: keep showing cached profile even with a bad token.
          // The user can still see their data; they'll need to re-login for mutations.
          console.warn('[Auth] ⚠️ Token rejected by AniList, keeping cached data');
        }
      } else {
        console.error('[Auth] ❌ Validation exhausted after retries, preserving state');
      }

      setIsValidatingToken(false);
    }
  }, []);

  // ── Initial auth check ────────────────────────────────────────────────────
  // FIX: This effect no longer needs to SET isLoggedIn/userData because lazy
  // initialisers already did that synchronously.  It only decides whether to
  // kick off a background re-validation.

  useEffect(() => {
    const token = getToken();

    if (!isValidToken(token)) return;

    const cached = loadCache();
    if (cached) {
      // State is already correct from lazy init — just decide on revalidation.
      if (needsRevalidation()) {
        console.log('[Auth] Cache restored, re-validating token in background…');
        validateToken(token);
      } else {
        console.log('[Auth] Cache fresh, skipping validation');
      }
    } else {
      // No cache — token exists but nothing to show yet. Validate to fetch data.
      console.log('[Auth] No cache found, validating token…');
      validateToken(token);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── OAuth event listeners ─────────────────────────────────────────────────

  useEffect(() => {
    const onTokenReceived = (e: Event) => {
      const token = (e as CustomEvent<{ token: string }>).detail?.token;
      if (!isValidToken(token)) return;

      // FIX: Do NOT set authLoading here — the cached data is already visible
      // on screen (set by lazy init or initial effect).  Just validate in the
      // background so the profile updates with fresh data if needed.
      console.log('[Auth] OAuth token received, validating…');
      const cached = loadCache();
      if (cached) {
        // Show cached data immediately while background-validating
        setUserData(cached);
        setIsLoggedIn(true);
      }
      validateToken(token);
    };

    const onAuthUpdate = () => {
      const token = getToken();
      if (!isValidToken(token)) {
        setIsLoggedIn(false); setUserData(null);
        return;
      }
      const cached = loadCache();
      if (cached) { setUserData(cached); setIsLoggedIn(true); }
      else validateToken(token);
    };

    window.addEventListener('authTokenReceived', onTokenReceived);
    window.addEventListener('authUpdate', onAuthUpdate);
    return () => {
      window.removeEventListener('authTokenReceived', onTokenReceived);
      window.removeEventListener('authUpdate', onAuthUpdate);
    };
  }, [validateToken]);

  // ── Notification polling ─────────────────────────────────────────────────

  useEffect(() => {
    if (!isLoggedIn) { setUnreadNotifications(0); return; }

    const token = getToken();
    if (!isValidToken(token)) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const count = await fetchNotificationCount(token);
        if (!cancelled && mounted.current) setUnreadNotifications(count);
      } catch { /* non-critical */ }
    };

    poll();
    const id = setInterval(poll, REVALIDATE_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [isLoggedIn]);

  // ── Auth actions ──────────────────────────────────────────────────────────

  const login = useCallback(async () => {
    try {
      const platform = import.meta.env.VITE_DEPLOY_PLATFORM;
      const endpoint = platform === 'VERCEL'
        ? '/api/get-csrf-token'
        : '/.netlify/functions/get-csrf-token';
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error(`CSRF fetch failed: ${res.status}`);
      const { csrfToken } = await res.json();
      sessionStorage.setItem('anilist_csrf', csrfToken);
      window.location.href = buildAuthUrl(csrfToken);
    } catch (err) {
      console.error('[Auth] login() failed:', err);
    }
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setIsLoggedIn(false);
    setUserData(null);
    setUnreadNotifications(0);
    window.dispatchEvent(new CustomEvent('authUpdate'));
    setTimeout(() => { window.location.href = '/profile'; }, 100);
  }, []);

  const refreshUserData = useCallback(async () => {
    const token = getToken();
    if (!isValidToken(token)) return;
    try {
      const data = await fetchUserData(token);
      if (mounted.current) { setUserData(data); setIsLoggedIn(true); }
      storeCache(data);
      stampValidation();
    } catch (err) {
      console.error('[Auth] refreshUserData failed:', err);
    }
  }, []);

  // Clears the unread-notification badge locally. We use resetNotificationCount:
  // false when fetching, so the server-side count is untouched — this only
  // reflects "the user has now seen them" in the UI.
  const markNotificationsRead = useCallback(() => {
    setUnreadNotifications(0);
  }, []);

  // ── List management ───────────────────────────────────────────────────────

  const saveEntry = useCallback(async (
    input: SaveEntryInput,
  ): Promise<MediaListEntry | null> => {
    const token = getToken();
    if (!isValidToken(token)) {
      console.warn('[Auth] saveEntry: not authenticated');
      return null;
    }
    try {
      console.log('[Auth] saveEntry START:', {
        mediaId: input.mediaId,
        status: input.status,
        score: input.score,
        progress: input.progress,
      });
      const result = await saveMediaListEntry(token, input);
      console.log('[Auth] saveEntry SUCCESS:', {
        id: result?.id,
        status: result?.status,
        score: result?.score,
        progress: result?.progress,
      });
      return result;
    } catch (err) {
      console.error('[Auth] saveEntry FAILED:', err instanceof Error ? err.message : err);
      return null;
    }
  }, []);

  const deleteEntry = useCallback(async (listEntryId: number): Promise<boolean> => {
    const token = getToken();
    if (!isValidToken(token)) return false;
    try {
      const deleted = await deleteMediaListEntry(token, listEntryId);
      if (!deleted) {
        console.warn('[Auth] deleteEntry returned false for', listEntryId);
      }
      return deleted;
    } catch (err) {
      console.error('[Auth] deleteEntry failed:', err);
      return false;
    }
  }, []);

  const toggleFav = useCallback(async (params: {
    animeId?: number; mangaId?: number; characterId?: number;
    staffId?: number; studioId?: number;
  }): Promise<boolean> => {
    const token = getToken();
    if (!isValidToken(token)) {
      console.warn('[Auth] toggleFav: not authenticated');
      return false;
    }
    try {
      console.log('[Auth] toggleFav START:', params);
      await toggleFavourite(token, params);
      console.log('[Auth] toggleFav SUCCESS:', params);
      return true;
    } catch (err) {
      console.error('[Auth] toggleFav FAILED:', err instanceof Error ? err.message : err);
      return false;
    }
  }, []);

  const getListEntry = useCallback(async (
    mediaId: number,
  ): Promise<MediaListEntry | null> => {
    const token = getToken();
    if (!isValidToken(token)) return null;
    try { return await fetchMediaListEntry(token, mediaId); }
    catch (err) { console.error('[Auth] getListEntry failed:', err); return null; }
  }, []);

  const getUserMediaState = useCallback(async (
    mediaId: number,
  ): Promise<UserMediaState | null> => {
    const token = getToken();
    if (!isValidToken(token)) return null;
    try { return await fetchUserMediaState(token, mediaId); }
    catch (err) { console.error('[Auth] getUserMediaState failed:', err); return null; }
  }, []);

  const updateProgress = useCallback(async (
    mediaId: number,
    progress: number,
    status?: MediaListStatus,
  ): Promise<MediaListEntry | null> => {
    return saveEntry({ mediaId, progress, ...(status ? { status } : {}) });
  }, [saveEntry]);

  // FIX: AuthProvider always renders children — the lazy-initialised state
  // is already correct on frame 1, so there is no need to block rendering
  // while localStorage is read (that happens synchronously in useState).
  return (
    <AuthContext.Provider value={{
      isLoggedIn, userData, username: userData?.name ?? null,
      isValidatingToken, unreadNotifications, markNotificationsRead,
      login, logout, refreshUserData,
      saveEntry, deleteEntry, toggleFav, getListEntry, getUserMediaState, updateProgress,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}