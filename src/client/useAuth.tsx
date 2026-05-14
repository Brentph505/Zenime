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
  fetchNotificationCount,
  type MediaListStatus,
  type SaveEntryInput,
} from './authService';

// ─── Re-export so callers don't need to import authService directly ──────────
export type { MediaListStatus, SaveEntryInput };

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
  };
}

export interface AuthContextType {
  // State
  isLoggedIn: boolean;
  userData: UserData | null;
  username: string | null;
  isValidatingToken: boolean;
  unreadNotifications: number;

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
  const [isLoggedIn, setIsLoggedIn]               = useState(false);
  const [userData, setUserData]                   = useState<UserData | null>(null);
  const [authLoading, setAuthLoading]             = useState(true);
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
      setAuthLoading(false);
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
      setAuthLoading(false);
    }
  }, []);

  // ── Initial auth check ────────────────────────────────────────────────────

  useEffect(() => {
    const token = getToken();

    if (!isValidToken(token)) {
      setAuthLoading(false);
      return;
    }

    const cached = loadCache();
    if (cached) {
      // Instantly restore UI — no blank screen on refresh
      setUserData(cached);
      setIsLoggedIn(true);
      setAuthLoading(false);

      if (needsRevalidation()) {
        console.log('[Auth] Cache restored, re-validating token in background…');
        validateToken(token);
      } else {
        console.log('[Auth] Cache fresh, skipping validation');
      }
    } else {
      // No cache — allow the app to render while validation runs.
      console.log('[Auth] No cache found, validating token…');
      setAuthLoading(false);
      validateToken(token);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── OAuth event listeners ─────────────────────────────────────────────────

  useEffect(() => {
    const onTokenReceived = (e: Event) => {
      const token = (e as CustomEvent<{ token: string }>).detail?.token;
      if (isValidToken(token)) {
        console.log('[Auth] OAuth token received, validating…');
        setAuthLoading(true);
        validateToken(token);
      }
    };

    const onAuthUpdate = () => {
      const token = getToken();
      if (!isValidToken(token)) {
        setIsLoggedIn(false); setUserData(null); setAuthLoading(false);
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

  // ── List management ───────────────────────────────────────────────────────

  const saveEntry = useCallback(async (
    input: SaveEntryInput,
  ): Promise<MediaListEntry | null> => {
    const token = getToken();
    if (!isValidToken(token)) { console.warn('[Auth] saveEntry: not authenticated'); return null; }
    try { return await saveMediaListEntry(token, input); }
    catch (err) { console.error('[Auth] saveEntry failed:', err); return null; }
  }, []);

  const deleteEntry = useCallback(async (listEntryId: number): Promise<boolean> => {
    const token = getToken();
    if (!isValidToken(token)) return false;
    try { await deleteMediaListEntry(token, listEntryId); return true; }
    catch (err) { console.error('[Auth] deleteEntry failed:', err); return false; }
  }, []);

  const toggleFav = useCallback(async (params: {
    animeId?: number; mangaId?: number; characterId?: number;
    staffId?: number; studioId?: number;
  }): Promise<boolean> => {
    const token = getToken();
    if (!isValidToken(token)) return false;
    try { await toggleFavourite(token, params); return true; }
    catch (err) { console.error('[Auth] toggleFav failed:', err); return false; }
  }, []);

  const getListEntry = useCallback(async (
    mediaId: number,
  ): Promise<MediaListEntry | null> => {
    const token = getToken();
    if (!isValidToken(token)) return null;
    try { return await fetchMediaListEntry(token, mediaId); }
    catch (err) { console.error('[Auth] getListEntry failed:', err); return null; }
  }, []);

  const updateProgress = useCallback(async (
    mediaId: number,
    progress: number,
    status?: MediaListStatus,
  ): Promise<MediaListEntry | null> => {
    return saveEntry({ mediaId, progress, ...(status ? { status } : {}) });
  }, [saveEntry]);

  // Block the tree only during the very first auth check
  if (authLoading) return null;

  return (
    <AuthContext.Provider value={{
      isLoggedIn, userData, username: userData?.name ?? null,
      isValidatingToken, unreadNotifications,
      login, logout, refreshUserData,
      saveEntry, deleteEntry, toggleFav, getListEntry, updateProgress,
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