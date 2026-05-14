import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import axios from 'axios';
import { UserData } from './userInfoTypes'; // Adjust the path as necessary
import { fetchUserData, buildAuthUrl } from './authService'; // Adjust the path as necessary

type AuthContextType = {
  isLoggedIn: boolean;
  userData: UserData | null;
  username: string | null; // This property must be handled
  isValidatingToken: boolean;
  login: () => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isValidatingToken, setIsValidatingToken] = useState(false);

  // Calculate username from userData
  const username = userData ? userData.name : null;

  // Helper function to store user data in localStorage
  const storeUserData = (data: UserData) => {
    try {
      const cacheData = {
        data,
        timestamp: Date.now(),
      };
      localStorage.setItem('userData', JSON.stringify(cacheData));
    } catch (err) {
      console.warn('Failed to store user data in localStorage:', err);
    }
  };

  // Helper function to load user data from localStorage
  const loadUserData = (): UserData | null => {
    try {
      const stored = localStorage.getItem('userData');
      if (!stored) return null;

      const cacheData = JSON.parse(stored);
      if (cacheData && typeof cacheData === 'object') {
        if ('data' in cacheData && cacheData.data) {
          return cacheData.data;
        }
        if ('name' in cacheData || 'id' in cacheData) {
          return cacheData as UserData;
        }
      }
      return null;
    } catch (err) {
      console.warn('Failed to load user data from localStorage:', err);
      return null;
    }
  };

  // Helper function to validate token and fetch user data
  const validateAndSetUserData = async (token: string, retryCount = 0) => {
    try {
      setIsValidatingToken(true);
      console.log(`🔄 [Auth] Validating token (attempt ${retryCount + 1})`);
      const data = await fetchUserData(token);
      setUserData(data);
      setIsLoggedIn(true);
      setAuthLoading(false);
      setIsValidatingToken(false);
      storeUserData(data); // Cache the user data
      console.log('✅ [Auth] User data fetched successfully:', data.name);
    } catch (err: any) {
      console.error('❌ [Auth] Failed to fetch user data:', err);

      // Check if it's a network error or token error
      const isNetworkError = !err.response || err.code === 'NETWORK_ERROR';
      const isTokenError = err.response?.status === 401 || err.response?.status === 403;

      if (isNetworkError && retryCount < 3) {
        // Network error - keep cached data and retry
        console.log(`🔄 [Auth] Network error, retrying token validation (attempt ${retryCount + 1})`);
        setTimeout(() => {
          validateAndSetUserData(token, retryCount + 1);
        }, 2000 * (retryCount + 1)); // Exponential backoff
      } else if (isTokenError || retryCount >= 3) {
        // Token is invalid or max retries reached
        console.log('❌ [Auth] Token validation failed, but keeping cached data if available');

        const hasCachedData = loadUserData() !== null;
        if (hasCachedData) {
          console.log('📦 [Auth] Keeping cached user data despite token validation failure');
          // Don't clear auth state if we have cached data
          setAuthLoading(false);
          setIsValidatingToken(false);
        } else {
          console.log('❌ [Auth] No cached data, clearing authentication');
          localStorage.removeItem('accessToken');
          localStorage.removeItem('userData');
          setIsLoggedIn(false);
          setUserData(null);
          setAuthLoading(false);
          setIsValidatingToken(false);
        }
      } else {
        // Other error - retry once more
        console.log(`🔄 [Auth] Retrying token validation (attempt ${retryCount + 1})`);
        setTimeout(() => {
          validateAndSetUserData(token, retryCount + 1);
        }, 1000);
      }
    } finally {
      // Only set validating to false if we're not retrying
      if (retryCount >= 3) {
        setIsValidatingToken(false);
      }
    }
  };

  // Initial auth check on mount
  useEffect(() => {
    // Check localStorage availability
    try {
      localStorage.setItem('test', 'test');
      localStorage.removeItem('test');
      console.log('✅ [Auth] localStorage is available');
    } catch (e) {
      console.error('❌ [Auth] localStorage is not available:', e);
      setAuthLoading(false);
      return;
    }

    const token = localStorage.getItem('accessToken');
    console.log('🔍 [Auth] Initial auth check - token exists:', !!token);
    console.log('🔍 [Auth] Token length:', token ? token.length : 0);
    console.log('🔍 [Auth] Token value (first 20 chars):', token ? token.substring(0, 20) + '...' : 'null');

    // More robust token validation
    const isValidToken = token && typeof token === 'string' && token.trim().length > 10;
    console.log('🔍 [Auth] Token is valid:', isValidToken);

    if (isValidToken) {
      // Load cached user data immediately for better UX
      const cachedData = loadUserData();
      if (cachedData) {
        setUserData(cachedData);
        setIsLoggedIn(true);
        setAuthLoading(false);
        console.log('📦 [Auth] Loaded cached user data:', cachedData.name);

        // Validate token in background only if it's been more than 5 minutes since last validation
        const lastValidation = localStorage.getItem('lastTokenValidation');
        const now = Date.now();
        const shouldValidate = !lastValidation || (now - parseInt(lastValidation)) > 5 * 60 * 1000; // 5 minutes

        if (shouldValidate) {
          console.log('🔄 [Auth] Starting background token validation');
          setTimeout(() => {
            validateAndSetUserData(token).then(() => {
              localStorage.setItem('lastTokenValidation', now.toString());
            });
          }, 1000); // Delay validation to not interfere with initial load
        } else {
          console.log('🔄 [Auth] Skipping token validation (recently validated)');
        }
      } else {
        console.log('📦 [Auth] No cached user data found, validating token immediately');
        // No cached data, validate token immediately
        setTimeout(() => {
          validateAndSetUserData(token).then(() => {
            localStorage.setItem('lastTokenValidation', Date.now().toString());
          });
        }, 100);
      }
    } else {
      console.log('🔍 [Auth] No valid token found, user not logged in');
      setAuthLoading(false);
    }
  }, []);

  const syncAuthState = (token?: string) => {
    const storedToken = token ?? localStorage.getItem('accessToken');
    const isValidToken = storedToken && typeof storedToken === 'string' && storedToken.trim().length > 10;

    if (!isValidToken) {
      setIsLoggedIn(false);
      setUserData(null);
      setAuthLoading(false);
      setIsValidatingToken(false);
      return;
    }

    const cachedData = loadUserData();
    if (cachedData) {
      setUserData(cachedData);
      setIsLoggedIn(true);
      setAuthLoading(false);
      console.log('📦 [Auth] Synced cached user data from localStorage:', cachedData.name);
    } else {
      console.log('📦 [Auth] No cached user data found during sync');
      setAuthLoading(true);
      // Only validate if no cached data
      setTimeout(() => validateAndSetUserData(storedToken as string), 100);
    }
  };

  // Listen for token changes from OAuth callback and auth state updates
  useEffect(() => {
    const handleTokenReceived = (event: Event) => {
      const customEvent = event as CustomEvent<{ token: string }>;
      const token = customEvent.detail?.token;
      if (token) {
        console.log('🔄 [Auth] Token received from OAuth, validating...');
        setAuthLoading(true);
        validateAndSetUserData(token);
      }
    };

    const handleAuthUpdate = () => {
      console.log('🔄 [Auth] authUpdate event received, syncing auth state from localStorage');
      syncAuthState();
    };

    window.addEventListener('authTokenReceived', handleTokenReceived);
    window.addEventListener('authUpdate', handleAuthUpdate);

    return () => {
      window.removeEventListener('authTokenReceived', handleTokenReceived);
      window.removeEventListener('authUpdate', handleAuthUpdate);
    };
  }, []);

  const login = async () => {
    try {
      const PLATFORM = import.meta.env.VITE_DEPLOY_PLATFORM;
      const csrfEndpoint = PLATFORM === 'VERCEL' ? '/api/get-csrf-token' : '/.netlify/functions/get-csrf-token';
      const response = await axios.get(csrfEndpoint);
      const csrfToken = response.data.csrfToken;
      const authUrl = buildAuthUrl(csrfToken);
      window.location.href = authUrl;
    } catch (error) {
      console.error('Error fetching CSRF token or building auth URL:', error);
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
    // Delay navigation to allow authUpdate to be processed
    setTimeout(() => {
      window.location.href = '/profile';
    }, 100);
  };

  // Prevent rendering of children if authentication status is unknown
  if (authLoading) {
    return null; // Or you could return a loading spinner or a similar component
  }

  return (
    <AuthContext.Provider
      value={{ isLoggedIn, userData, username, isValidatingToken, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
