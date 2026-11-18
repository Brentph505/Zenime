const THUMBNAIL_CACHE_KEY = 'episode-thumbnail-cache-v1';
const MAX_THUMBNAIL_CACHE_ENTRIES = 300;

type ThumbnailSource = 'tmdb' | 'episode';
type ThumbnailCache = Record<string, string>;

function makeKey(
  animeId: string,
  episodeNumber: string | number,
  source: ThumbnailSource,
): string {
  return `${source}:${animeId}:${String(episodeNumber)}`;
}

function readCache(): ThumbnailCache {
  try {
    const raw = localStorage.getItem(THUMBNAIL_CACHE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as ThumbnailCache)
      : {};
  } catch {
    return {};
  }
}

export function getEpisodeThumbnail(
  animeId: string,
  episodeNumber: string | number,
  source: ThumbnailSource,
): string | null {
  if (!animeId || episodeNumber === '') return null;
  const image = readCache()[makeKey(animeId, episodeNumber, source)];
  return typeof image === 'string' && image ? image : null;
}

export function saveEpisodeThumbnail(
  animeId: string,
  episodeNumber: string | number,
  source: ThumbnailSource,
  image: string,
): void {
  if (!animeId || episodeNumber === '' || !image) return;

  const cache = readCache();
  const key = makeKey(animeId, episodeNumber, source);
  delete cache[key];
  cache[key] = image;

  const keys = Object.keys(cache);
  for (const staleKey of keys.slice(0, Math.max(0, keys.length - MAX_THUMBNAIL_CACHE_ENTRIES))) {
    delete cache[staleKey];
  }

  try {
    localStorage.setItem(THUMBNAIL_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Thumbnail URLs are optional; don't evict watch history to make room.
  }
}

export function removeEpisodeThumbnail(
  animeId: string,
  episodeNumber: string | number,
  source: ThumbnailSource,
  expectedImage?: string,
): void {
  const cache = readCache();
  const key = makeKey(animeId, episodeNumber, source);
  if (!(key in cache) || (expectedImage && cache[key] !== expectedImage)) return;
  delete cache[key];

  try {
    localStorage.setItem(THUMBNAIL_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // A failed cleanup is harmless; the image fallback still works.
  }
}