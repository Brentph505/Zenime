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
  login: () => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Calculate username from userData
  const username = userData ? userData.name : null;

  // Helper function to validate token and fetch user data
  const validateAndSetUserData = async (token: string) => {
    try {
      const data = await fetchUserData(token);
      setUserData(data);
      setIsLoggedIn(true);
      setAuthLoading(false);
      console.log('✅ [Auth] User data fetched successfully:', data.name);
    } catch (err) {
      console.error('❌ [Auth] Failed to fetch user data:', err);
      localStorage.removeItem('accessToken');
      setIsLoggedIn(false);
      setUserData(null);
      setAuthLoading(false);
    }
  };

  // Initial auth check on mount
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
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
      value={{ isLoggedIn, userData, username, login, logout }}
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
