import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';

type ThemeContextType = {
  isDarkMode: boolean;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => useContext(ThemeContext)!;

type ThemeProviderProps = {
  children: ReactNode;
};

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialThemeMode);
  const [systemPrefersDark, setSystemPrefersDark] = useState(() =>
    getSystemThemePreference(),
  );
  const isDarkMode = themeMode === 'system' ? systemPrefersDark : themeMode === 'dark';

  useEffect(() => {
    document.documentElement.classList.toggle('dark-mode', isDarkMode);
    localStorage.setItem('themePreference', themeMode);
  }, [isDarkMode, themeMode]);

  useEffect(() => {
    if (themeMode !== 'system' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent) => setSystemPrefersDark(event.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [themeMode]);

  const toggleTheme = useCallback(() => {
    setThemeMode((currentMode) => {
      const currentIsDark = currentMode === 'system' ? systemPrefersDark : currentMode === 'dark';
      return currentIsDark ? 'light' : 'dark';
    });
  }, [systemPrefersDark]);

  return (
    <ThemeContext.Provider value={{ isDarkMode, themeMode, setThemeMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

const getInitialThemeMode = (): ThemeMode => {
  const storedThemePreference = localStorage.getItem('themePreference');
  return storedThemePreference === 'dark' || storedThemePreference === 'light'
    ? storedThemePreference
    : 'system';
};

const getSystemThemePreference = (): boolean => {
  return Boolean(
    window.matchMedia?.('(prefers-color-scheme: dark)').matches,
  );
};
