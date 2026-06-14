export const LOCAL_STORAGE_KEYS = {
  READ_CHAPTERS: 'read-chapters',
  LAST_MANGA_VISITED: 'last-manga-visited',
  READING_PROGRESS: 'all_reading_times',
};

export interface LastMangaVisitedEntry {
  timestamp: number;
  titleEnglish?: string;
  titleRomaji?: string;
  status?: string;
  coverImage?: string;
}

export interface MangaReadChapterEntry {
  id: string;
  number?: string | number;
  title?: string;
  image?: string;
  description?: string;
  imageHash?: string;
  airDate?: string;
  url?: string;
}

export const getLastMangaVisited = (): Record<string, LastMangaVisitedEntry> =>
  JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.LAST_MANGA_VISITED) || '{}');

export const saveLastMangaVisited = (
  animeId: string,
  entry: Partial<LastMangaVisitedEntry>,
) => {
  const all = getLastMangaVisited();
  const existing = all[animeId] || {};

  all[animeId] = {
    ...existing,
    ...entry,
    timestamp: entry.timestamp ?? Date.now(),
    coverImage:
      entry.coverImage === undefined ? existing.coverImage : entry.coverImage,
  };

  localStorage.setItem(
    LOCAL_STORAGE_KEYS.LAST_MANGA_VISITED,
    JSON.stringify(all),
  );
};

export const getReadChapters = (): Record<string, MangaReadChapterEntry[]> =>
  JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.READ_CHAPTERS) || '{}');

export const addReadChapterIfMissing = (
  animeId: string,
  chapter: MangaReadChapterEntry,
) => {
  const allChapters = getReadChapters();
  if (!allChapters[animeId]) {
    allChapters[animeId] = [];
  }

  if (!allChapters[animeId].some((ch) => ch.id === chapter.id)) {
    allChapters[animeId].push(chapter);
    localStorage.setItem(
      LOCAL_STORAGE_KEYS.READ_CHAPTERS,
      JSON.stringify(allChapters),
    );
  }
};
