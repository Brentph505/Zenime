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
      // Check if cache is older than 24 hours
      const isExpired = Date.now() - cacheData.timestamp > 24 * 60 * 60 * 1000;

      if (isExpired) {
        localStorage.removeItem('userData');
        return null;
      }

      return cacheData.data;
    } catch (err) {
      console.warn('Failed to load user data from localStorage:', err);
      return null;
    }
  };

  // Helper function to validate token and fetch user data
  const validateAndSetUserData = async (token: string, retryCount = 0) => {
    try {
      setIsValidatingToken(true);
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
        // Network error - retry with cached data if available
        const cachedData = loadUserData();
        if (cachedData && !userData) {
          console.log('📦 [Auth] Using cached user data while retrying');
          setUserData(cachedData);
          setIsLoggedIn(true);
        }
        console.log(`🔄 [Auth] Network error, retrying token validation (attempt ${retryCount + 1})`);
        setTimeout(() => {
          validateAndSetUserData(token, retryCount + 1);
        }, 2000 * (retryCount + 1)); // Exponential backoff
      } else if (isTokenError || retryCount >= 3) {
        // Token is invalid or max retries reached
        console.log('❌ [Auth] Token is invalid or max retries reached, removing token');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('userData');
        setIsLoggedIn(false);
        setUserData(null);
        setAuthLoading(false);
        setIsValidatingToken(false);
      } else {
        // Other error - retry once more
        console.log(`🔄 [Auth] Retrying token validation (attempt ${retryCount + 1})`);
        setTimeout(() => {
          validateAndSetUserData(token, retryCount + 1);
        }, 1000);
      }
    } finally {
      setIsValidatingToken(false);
    }
  };

  // Initial auth check on mount
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      // Load cached user data immediately for better UX
      const cachedData = loadUserData();
      if (cachedData) {
        setUserData(cachedData);
        setIsLoggedIn(true);
        console.log('📦 [Auth] Loaded cached user data:', cachedData.name);
      }
      // Validate token in background
      setIsValidatingToken(true);
      validateAndSetUserData(token);
    } else {
      setAuthLoading(false);
    }
  }, []);

  // Listen for token changes from OAuth callback
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

    window.addEventListener('authTokenReceived', handleTokenReceived);
    return () => window.removeEventListener('authTokenReceived', handleTokenReceived);
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
    setIsLoggedIn(false);
    setUserData(null);
    setAuthLoading(false);
    window.location.href = '/profile';
    window.dispatchEvent(new CustomEvent('authUpdate'));
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
