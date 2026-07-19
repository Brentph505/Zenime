import { useMemo } from 'react';
import { useSettings } from '../index';

interface TitleObj {
  english?: string | null;
  romaji?: string;
  native?: string;
  userPreferred?: string;
}

/**
 * Hook to get the appropriate title based on user's titleLanguage setting
 */
export const useTitle = (title: TitleObj | undefined): string => {
  const { settings } = useSettings();

  return useMemo(() => {
    if (!title) return '';

    // Parse titleLanguage setting which comes as:
    // 'English (Attack on Titan)' -> need to extract format
    // 'Romaji (Shingeki no Kyojin)'
    // 'Native (進撃の巨人)'
    
    if (settings.titleLanguage.includes('English')) {
      return title.english || title.romaji || title.native || '';
    } else if (settings.titleLanguage.includes('Native')) {
      return title.native || title.romaji || title.english || '';
    } else {
      // Default to Romaji
      return title.romaji || title.english || title.native || '';
    }
  }, [title, settings.titleLanguage]);
};
