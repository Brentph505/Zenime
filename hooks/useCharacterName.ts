import { useMemo } from 'react';
import { useSettings } from '../components/Profile/SettingsProvider';

interface TitleObj {
  full?: string;
  english?: string | null;
  romaji?: string;
  native?: string;
  userPreferred?: string;
}

/**
 * Hook that returns character name based on user's language preference
 * 
 * English setting: returns English name, then Romaji/full, then Native
 * Romaji setting: returns Romaji then English/full, then Native
 * Native setting: returns Native then full, then Romaji/English
 */
export const useCharacterName = (nameObj: TitleObj | undefined): string => {
  const { settings } = useSettings();

  return useMemo(() => {
    if (!nameObj) return '';

    const english = nameObj.english || '';
    const romaji = nameObj.romaji || '';
    const native = nameObj.native || '';
    const full = nameObj.full || nameObj.userPreferred || '';

    if (settings.characterNameLanguage.includes('English')) {
      return english || romaji || full || native || '';
    } else if (settings.characterNameLanguage.includes('Native')) {
      return native || full || romaji || english || '';
    } else {
      // Romaji (default)
      return romaji || english || full || native || '';
    }
  }, [nameObj, settings.characterNameLanguage]);
};
