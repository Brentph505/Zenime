import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';

// Define the type for the context state
interface SettingsContextType {
  settings: {
    autoSkip: boolean;
    autoPlay: boolean;
    autoNext: boolean;
    defaultLanguage: string;
    defaultServers: string;
    aniListSync: boolean;
    syncThreshold: number;
    watchOrInfo: 'Watch' | 'Info';
    titleLanguage: string;
    characterNameLanguage: string;
    hideSpoilers: boolean;
  };
  setSettings: (settings: Partial<SettingsContextType['settings']>) => void;
}

// Create the context with a default value
const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined,
);

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}

interface SettingsProviderProps {
  children: ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({
  children,
}) => {
   const [settings, setSettingsState] = useState({
     autoSkip: localStorage.getItem('autoSkip') === 'true',
     autoPlay: localStorage.getItem('autoPlay') === 'true' || !localStorage.getItem('autoPlay'),
     autoNext: localStorage.getItem('autoNext') === 'true',
     defaultLanguage: localStorage.getItem('defaultLanguage') || 'sub',
     defaultServers: localStorage.getItem('defaultServers') || 'default',
     aniListSync: localStorage.getItem('aniListSync') === 'true',
     syncThreshold: Number(localStorage.getItem('syncThreshold')) || 80,
     watchOrInfo: (localStorage.getItem('watchOrInfo') as 'Watch' | 'Info') || 'Watch',
     titleLanguage: localStorage.getItem('titleLanguage') || 'Romaji',
     characterNameLanguage: localStorage.getItem('characterNameLanguage') || 'Romaji',
     hideSpoilers: localStorage.getItem('hideSpoilers') === 'true',
   });

  useEffect(() => {
    // This useEffect will ensure that any changes to the settings state are reflected in local storage
    // console.log('Settings updated:', settings);
    localStorage.setItem('autoSkip', settings.autoSkip ? 'true' : 'false');
    localStorage.setItem('autoPlay', settings.autoPlay ? 'true' : 'false');
    localStorage.setItem('autoNext', settings.autoNext ? 'true' : 'false');
    localStorage.setItem('defaultLanguage', settings.defaultLanguage);
    localStorage.setItem('defaultServers', settings.defaultServers);
    localStorage.setItem('aniListSync', settings.aniListSync ? 'true' : 'false');
    localStorage.setItem('syncThreshold', String(settings.syncThreshold));
    localStorage.setItem('watchOrInfo', settings.watchOrInfo);
    localStorage.setItem('titleLanguage', settings.titleLanguage);
    localStorage.setItem('characterNameLanguage', settings.characterNameLanguage);
    localStorage.setItem('hideSpoilers', settings.hideSpoilers ? 'true' : 'false');
  }, [settings]);

  // Memoised so consumers' callbacks/effects depending on setSettings don't
  // churn every render. Previously this was an inline function recreated each
  // render, which caused the autosync hooks to restart their intervals far
  // more often than necessary.
  const setSettings = useCallback(
    (newSettings: Partial<SettingsContextType['settings']>) => {
      setSettingsState((prev) => ({ ...prev, ...newSettings }));
    },
    [],
  );

  return (
    <SettingsContext.Provider value={{ settings, setSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};
