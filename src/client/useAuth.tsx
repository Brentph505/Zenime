import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  ReactNode,
} from 'react';
import axios from 'axios';
import { UserData } from './userInfoTypes';
import { fetchUserData, buildAuthUrl } from './authService';

type AuthContextType = {
  isLoggedIn: boolean;
  userData: UserData | null;
  username: string | null;
  isValidatingToken: boolean;
  login: () => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─── Cache helpers (module-level, no state) ───────────────────────────────────

function storeUserData(data: UserData) {
  try {
    localStorage.setItem('userData', JSON.stringify({ data, timestamp: Date.now() }));
  } catch (err) {
    console.warn('[Auth] Failed to store user data:', err);
  }
}

function loadUserData(): UserData | null {
  try {
    const stored = localStorage.getItem('userData');
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    // Handle both { data: UserData, timestamp } and bare UserData shapes
    if (parsed && typeof parsed === 'object') {
      if ('data' in parsed && parsed.data && 'name' in parsed.data) {
        return parsed.data as UserData;
      }
      if ('name' in parsed) {
        return parsed as UserData;
      }
    }
    return null;
  } catch (err) {
    console.warn('[Auth] Failed to load user data:', err);
    return null;
  }
}

function isTokenValid(token: string | null): token is string {
  return (
    typeof token === 'string' &&
    token.trim().length > 10 &&
    token.trim() !== 'undefined' &&
    token.trim() !== 'null'
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  // Start as true only if a token exists; avoids unnecessary loading flash
  const [authLoading, setAuthLoading] = useState(true);
  const [isValidatingToken, setIsValidatingToken] = useState(false);

  const username = userData?.name ?? null;

  // Track whether the component is still mounted to avoid state updates after unmount
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // ─── Token validation ───────────────────────────────────────────────────────

  const validateToken = async (token: string, attempt = 0): Promise<void> => {
    if (!isMounted.current) return;

    setIsValidatingToken(true);

    try {
      console.log(`[Auth] Validating token (attempt ${attempt + 1})`);
      const data = await fetchUserData(token);

      if (!isMounted.current) return;

      setUserData(data);
      setIsLoggedIn(true);
      storeUserData(data);
      localStorage.setItem('lastTokenValidation', Date.now().toString());
      console.log('[Auth] Token valid, user:', data.name);
    } catch (err: any) {
      if (!isMounted.current) return;

      const status = err.response?.status;
      const isAuthError = status === 401 || status === 403;
      const isNetworkError = !err.response || err.code === 'ERR_NETWORK';

      console.warn('[Auth] Token validation error:', { status, isAuthError, isNetworkError });

      if (!isAuthError && attempt < 2) {
        // Transient / network error — retry with back-off
        const delay = isNetworkError ? 3000 * (attempt + 1) : 1500;
        console.log(`[Auth] Retrying in ${delay}ms…`);
        setTimeout(() => validateToken(token, attempt + 1), delay);
        return; // keep isValidatingToken true while retrying
      }

      if (isAuthError) {
        // Token is definitively rejected by AniList
        const cached = loadUserData();
        if (cached) {
          // Keep showing cached data — don't force logout on every network hiccup
          console.log('[Auth] Token rejected but keeping cached user data');
          // Leave isLoggedIn / userData as-is (already set from cache below)
        } else {
          console.log('[Auth] Token rejected, no cache — clearing session');
          localStorage.removeItem('accessToken');
          localStorage.removeItem('userData');
          localStorage.removeItem('lastTokenValidation');
          setIsLoggedIn(false);
          setUserData(null);
        }
      }
      // For non-auth errors after retries: keep whatever state we already have
    } finally {
      if (isMounted.current) {
        setIsValidatingToken(false);
        setAuthLoading(false);
      }
    }
  };

  // ─── Initial auth check on mount ───────────────────────────────────────────

  useEffect(() => {
    const token = localStorage.getItem('accessToken');

    if (!isTokenValid(token)) {
      // No usable token → not logged in, done loading immediately
      setAuthLoading(false);
      return;
    }

    // Show cached data immediately so the UI isn't blank on refresh
    const cached = loadUserData();
    if (cached) {
      setUserData(cached);
      setIsLoggedIn(true);
      console.log('[Auth] Restored from cache:', cached.name);

      // Only re-validate if it's been more than 5 minutes
      const last = localStorage.getItem('lastTokenValidation');
      const stale = !last || Date.now() - parseInt(last) > 5 * 60 * 1000;

      if (stale) {
        console.log('[Auth] Cache stale, background-validating token…');
        // Don't block render — setAuthLoading(false) happens after cache restore
        setAuthLoading(false);
        validateToken(token);
      } else {
        console.log('[Auth] Cache fresh, skipping validation');
        setAuthLoading(false);
      }
    } else {
      // No cache — must validate before showing anything
      console.log('[Auth] No cache, validating token immediately…');
      validateToken(token);
      // authLoading will be set to false inside validateToken's finally block
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Listen for OAuth callback events ──────────────────────────────────────

  useEffect(() => {
    const onTokenReceived = (e: Event) => {
      const token = (e as CustomEvent<{ token: string }>).detail?.token;
      if (token && isTokenValid(token)) {
        console.log('[Auth] OAuth token received, validating…');
        validateToken(token);
      }
    };

    const onAuthUpdate = () => {
      console.log('[Auth] authUpdate event — re-syncing from localStorage');
      const token = localStorage.getItem('accessToken');
      if (!isTokenValid(token)) {
        setIsLoggedIn(false);
        setUserData(null);
        setAuthLoading(false);
        return;
      }
      const cached = loadUserData();
      if (cached) {
        setUserData(cached);
        setIsLoggedIn(true);
      } else {
        validateToken(token!);
      }
    };

    window.addEventListener('authTokenReceived', onTokenReceived);
    window.addEventListener('authUpdate', onAuthUpdate);
    return () => {
      window.removeEventListener('authTokenReceived', onTokenReceived);
      window.removeEventListener('authUpdate', onAuthUpdate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Login / Logout ─────────────────────────────────────────────────────────

  const login = async () => {
    try {
      const platform = import.meta.env.VITE_DEPLOY_PLATFORM;
      const csrfEndpoint =
        platform === 'VERCEL'
          ? '/api/get-csrf-token'
          : '/.netlify/functions/get-csrf-token';
      const { data } = await axios.get(csrfEndpoint);
      window.location.href = buildAuthUrl(data.csrfToken);
    } catch (err) {
      console.error('[Auth] Failed to start login flow:', err);
    }
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('userData');
    localStorage.removeItem('lastTokenValidation');
    setIsLoggedIn(false);
    setUserData(null);
    setAuthLoading(false);
    window.dispatchEvent(new CustomEvent('authUpdate'));
    setTimeout(() => { window.location.href = '/profile'; }, 100);
  };

  // Block render only during the very first auth check
  if (authLoading) return null;

  return (
    <AuthContext.Provider value={{ isLoggedIn, userData, username, isValidatingToken, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
