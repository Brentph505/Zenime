import { useMemo } from 'react';
import { useSettings } from '../components/Profile/SettingsProvider';

interface TitleObj {
  english?: string | null;
  romaji?: string;
  native?: string;
  userPreferred?: string;
}

interface TitleDisplay {
  title: string;
  subtitle: string;
}

/**
 * Hook that returns both main title and subtitle based on user's language preference
 * 
 * English setting: title=English, subtitle=Romaji (repeat English if no Romaji)
 * Romaji setting: title=Romaji, subtitle=English (repeat Romaji if no English)
 * Native setting: title=Native, subtitle=Romaji (repeat Native if no Romaji)
 */
export const useTitleWithSubtitle = (titleObj: TitleObj | undefined): TitleDisplay => {
  const { settings } = useSettings();

  return useMemo(() => {
    if (!titleObj) return { title: '', subtitle: '' };

    const english = titleObj.english || '';
    const romaji = titleObj.romaji || '';
    const native = titleObj.native || '';

    if (settings.titleLanguage.includes('English')) {
      return {
        title: english || romaji || '',
        subtitle: romaji || english || '',
      };
    } else if (settings.titleLanguage.includes('Native')) {
      return {
        title: native || romaji || english || '',
        subtitle: romaji || native || '',
      };
    } else {
      // Romaji (default)
      return {
        title: romaji || english || '',
        subtitle: english || romaji || '',
      };
    }
  }, [titleObj, settings.titleLanguage]);
};
