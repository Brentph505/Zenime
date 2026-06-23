import { useMemo } from 'react';
import { useSettings } from '../components/Profile/SettingsProvider';

interface TitleObj {
  english?: string | null;
  romaji?: string;
  native?: string;
  userPreferred?: string;
}

/**
 * Hook that returns character name based on user's language preference
 * 
 * English setting: returns English name
 * Romaji setting: returns Romaji name
 * Native setting: returns Native name
 */
export const useCharacterName = (nameObj: TitleObj | undefined): string => {
  const { settings } = useSettings();

  return useMemo(() => {
    if (!nameObj) return '';

    const english = nameObj.english || '';
    const romaji = nameObj.romaji || '';
    const native = nameObj.native || '';

    if (settings.characterNameLanguage.includes('English')) {
      return english || romaji || native || '';
    } else if (settings.characterNameLanguage.includes('Native')) {
      return native || romaji || english || '';
    } else {
      // Romaji (default)
      return romaji || english || native || '';
    }
  }, [nameObj, settings.characterNameLanguage]);
};
