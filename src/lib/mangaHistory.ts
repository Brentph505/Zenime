export const LOCAL_STORAGE_KEYS = {
  READ_CHAPTERS: 'read-chapters',
  LAST_MANGA_VISITED: 'last-manga-visited',
  READING_PROGRESS: 'all_reading_times',
  MANGA_BOOKMARKS: 'manga-bookmarks',
} as const;

/**
 * Custom event dispatched whenever bookmarks change so in-tab listeners
 * (e.g. the History Bookmarks tab) can refresh. The native `storage` event
 * only fires across tabs, not within the same document.
 */
export const MANGA_BOOKMARKS_CHANGED_EVENT = 'manga-bookmarks-changed';

const dispatchBookmarksChanged = () => {
  try {
    window.dispatchEvent(new CustomEvent(MANGA_BOOKMARKS_CHANGED_EVENT));
  } catch {
    /* non-browser / no window */
  }
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

/** Stored per-manga pointer to the last chapter the reader had open. */
export interface LastReadChapterEntry {
  id: string;
  number?: string | number;
  title?: string;
  url?: string;
}

// ── last-manga-visited ────────────────────────────────────────────────────────

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

// ── read-chapters ─────────────────────────────────────────────────────────────

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

// ── manga-bookmarks ───────────────────────────────────────────────────────────

export type MangaBookmarks = Record<string, { timestamp: number }>;

export const getMangaBookmarks = (): MangaBookmarks =>
  JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.MANGA_BOOKMARKS) || '{}');

export const isMangaBookmarked = (mangaId: string): boolean =>
  !!getMangaBookmarks()[mangaId];

/** Toggle a bookmark, persist it, and notify same-tab listeners. Returns the new state. */
export const setMangaBookmark = (mangaId: string, on: boolean): boolean => {
  const all = getMangaBookmarks();
  if (on) {
    all[mangaId] = { timestamp: Date.now() };
  } else {
    delete all[mangaId];
  }
  localStorage.setItem(LOCAL_STORAGE_KEYS.MANGA_BOOKMARKS, JSON.stringify(all));
  dispatchBookmarksChanged();
  return on;
};

/** Convenience: flip the current bookmark state. Returns the new state. */
export const toggleMangaBookmark = (mangaId: string): boolean =>
  setMangaBookmark(mangaId, !isMangaBookmarked(mangaId));

/** Remove every bookmark. Used by History's "clear all". */
export const clearMangaBookmarks = (): void => {
  localStorage.removeItem(LOCAL_STORAGE_KEYS.MANGA_BOOKMARKS);
  dispatchBookmarksChanged();
};

// ── last-read-chapter-{mangaId} ───────────────────────────────────────────────
// Per-manga pointer to the last chapter the reader had open. Mirrors the anime
// side's `last-watched-{animeId}`. Priority: ?chapterId= URL param > this > chs[0].

const lastReadChapterKey = (mangaId: string) => `last-read-chapter-${mangaId}`;

export const getLastReadChapter = (
  mangaId: string,
): LastReadChapterEntry | null => {
  try {
    const raw = localStorage.getItem(lastReadChapterKey(mangaId));
    return raw ? (JSON.parse(raw) as LastReadChapterEntry) : null;
  } catch {
    return null;
  }
};

export const setLastReadChapter = (
  mangaId: string,
  entry: LastReadChapterEntry,
): void => {
  try {
    localStorage.setItem(lastReadChapterKey(mangaId), JSON.stringify(entry));
  } catch {
    /* storage unavailable */
  }
};

