/**
 * watchHistory.ts
 *
 * Unified read path for local anime watch progress. The app stores history in
 * several places (legacy localStorage, size-capped cache, IndexedDB); sync
 * and UI helpers merge them here.
 */

export const WATCH_HISTORY_CHANGED_EVENT = 'watch-history-changed';

export const WATCHED_EPISODES_KEY = 'watched-episodes';
export const WATCHED_EPISODES_CACHE_KEY = 'watched-episodes-cache';
export const LAST_ANIME_VISITED_KEY = 'last-anime-visited';

export function dispatchWatchHistoryChanged(): void {
  try {
    window.dispatchEvent(new CustomEvent(WATCH_HISTORY_CHANGED_EVENT));
  } catch {
    /* non-browser */
  }
}

/** Highest episode number (or count) from any stored watch-history shape. */
export function getWatchedCount(value: unknown): number {
  if (typeof value === 'number') return value;
  if (Array.isArray(value)) {
    let max = 0;
    for (const ep of value) {
      if (ep == null) continue;
      if (typeof ep === 'number') {
        max = Math.max(max, ep);
      } else if (typeof ep === 'object' && 'number' in ep) {
        const n = Number((ep as { number: unknown }).number);
        if (!Number.isNaN(n)) max = Math.max(max, n);
      }
    }
    return max || value.length;
  }
  return 0;
}

function parseRecord(key: string): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

// ─── IndexedDB (full watch history) ──────────────────────────────────────────

class WatchHistoryDB {
  private dbPromise: Promise<IDBDatabase>;
  private readonly DB_NAME = 'ZenimeWatchDB';
  private readonly STORE_NAME = 'watchedEpisodes';

  constructor() {
    this.dbPromise = this.initDB();
  }

  private initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME, { keyPath: 'animeId' });
        }
      };
    });
  }

  async saveWatchedEpisodes(animeId: string, episodes: unknown[]): Promise<void> {
    try {
      const db = await this.dbPromise;
      const tx = db.transaction(this.STORE_NAME, 'readwrite');
      const store = tx.objectStore(this.STORE_NAME);
      await new Promise<void>((resolve, reject) => {
        const req = store.put({ animeId, episodes, timestamp: Date.now() });
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('[WatchHistoryDB] Failed to save:', err);
    }
  }

  async getWatchedEpisodes(animeId: string): Promise<unknown[] | null> {
    try {
      const db = await this.dbPromise;
      const tx = db.transaction(this.STORE_NAME, 'readonly');
      const store = tx.objectStore(this.STORE_NAME);
      return new Promise((resolve, reject) => {
        const req = store.get(animeId);
        req.onsuccess = () => resolve(req.result?.episodes ?? null);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return null;
    }
  }

  async getAllWatchedAnime(): Promise<Record<string, unknown[]>> {
    try {
      const db = await this.dbPromise;
      const tx = db.transaction(this.STORE_NAME, 'readonly');
      const store = tx.objectStore(this.STORE_NAME);
      return new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => {
          const result: Record<string, unknown[]> = {};
          for (const item of req.result as Array<{ animeId: string; episodes: unknown[] }>) {
            result[item.animeId] = item.episodes;
          }
          resolve(result);
        };
        req.onerror = () => reject(req.error);
      });
    } catch {
      return {};
    }
  }
}

export const watchHistoryDB = new WatchHistoryDB();

/** Merge legacy, cache, and IndexedDB watch data (highest count wins per anime). */
export async function getAllWatchedAnimeMap(): Promise<Record<string, unknown>> {
  const merged: Record<string, unknown> = {
    ...parseRecord(WATCHED_EPISODES_KEY),
    ...parseRecord(WATCHED_EPISODES_CACHE_KEY),
  };

  const fromIdb = await watchHistoryDB.getAllWatchedAnime();
  for (const [animeId, episodes] of Object.entries(fromIdb)) {
    const existing = getWatchedCount(merged[animeId]);
    const fromDb = getWatchedCount(episodes);
    if (fromDb >= existing) {
      merged[animeId] = episodes;
    }
  }

  return merged;
}

export function getLastAnimeVisitedMap(): Record<string, Record<string, unknown>> {
  return parseRecord(LAST_ANIME_VISITED_KEY) as Record<string, Record<string, unknown>>;
}

/** Minimal episode shape used across watch history + AniList sync. */
export interface WatchHistoryEpisode {
  id: string;
  number: number;
  title: string;
  description: string | null;
  image: string;
  imageHash: string;
  airDate: string | null;
}

/** Build a placeholder episode object from an AniList progress count. */
export function buildSyntheticEpisode(
  animeId: string,
  progress: number,
): WatchHistoryEpisode {
  const ep = Math.max(1, Math.floor(progress));
  return {
    id: `anilist-sync-${animeId}-${ep}`,
    number: ep,
    title: `Episode ${ep}`,
    description: null,
    image: '',
    imageHash: '',
    airDate: null,
  };
}

/**
 * Normalize any stored watch-history value into an Episode[].
 * Falls back to `anilistProgress` from last-anime-visited when the stored
 * value is a bare number (legacy AniList sync shape).
 */
export function normalizeToEpisodeArray(
  animeId: string,
  value: unknown,
  anilistProgress?: number | null,
): WatchHistoryEpisode[] {
  if (Array.isArray(value)) {
    return value
      .filter((ep) => ep && typeof ep === 'object')
      .map((ep) => {
        const obj = ep as Record<string, unknown>;
        const num = Number(obj.number);
        return {
          id: String(obj.id ?? `ep-${num}`),
          number: Number.isNaN(num) ? 1 : num,
          title: String(obj.title ?? `Episode ${num}`),
          description: (obj.description as string | null | undefined) ?? null,
          image: String(obj.image ?? ''),
          imageHash: String(obj.imageHash ?? ''),
          airDate: (obj.airDate as string | null | undefined) ?? null,
        };
      });
  }

  const fromValue =
    typeof value === 'number' ? value : getWatchedCount(value);
  const progress = Math.max(fromValue, anilistProgress ?? 0);

  if (progress > 0) {
    return [buildSyntheticEpisode(animeId, progress)];
  }

  return [];
}

/** Resolve the last watched episode number from any storage shape. */
export function resolveLastEpisodeNumber(
  value: unknown,
  anilistProgress?: number | null,
): number {
  const fromArray = getWatchedCount(value);
  const fromAnilist = anilistProgress ?? 0;
  return Math.max(fromArray, fromAnilist, 0);
}
