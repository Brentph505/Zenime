import axios from 'axios';
import { year, getCurrentSeason, getNextSeason } from '../index';

// Utility function to ensure URL ends with a slash
function ensureUrlEndsWithSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}

// Adjusting environment variables to ensure they end with a slash
const BASE_URL = ensureUrlEndsWithSlash(
  import.meta.env.VITE_BACKEND_URL as string,
);
const SKIP_TIMES = ensureUrlEndsWithSlash(
  import.meta.env.VITE_SKIP_TIMES as string,
);
let PROXY_URL = import.meta.env.VITE_PROXY_URL;
if (PROXY_URL) {
  PROXY_URL = ensureUrlEndsWithSlash(import.meta.env.VITE_PROXY_URL as string);
}

const API_KEY = import.meta.env.VITE_API_KEY as string;

// M3U8 Proxy
const M3U8_PROXY_URL = import.meta.env.VITE_M3U8_PROXY_URL as string;

// Official AniList GraphQL endpoint
const ANILIST_GRAPHQL_URL = 'https://graphql.anilist.co';

// GraphQL query to fetch all available genres from AniList
const GENRE_QUERY = `
  query {
    genres: GenreCollection
  }
`;

// Axios instance
const axiosInstance = axios.create({
  baseURL: PROXY_URL || undefined,
  timeout: 10000,
  headers: {
    'X-API-Key': API_KEY,
  },
});

axiosInstance.interceptors.response.use(
  (response) => {
    console.log(
      `✅ [Axios] Response - Status: ${response.status}, URL: ${response.config.url}`,
    );
    return response;
  },
  (error) => {
    console.error(
      `❌ [Axios] Error - Status: ${error.response?.status}, URL: ${error.config?.url}, Message: ${error.message}`,
    );
    return Promise.reject(error);
  },
);

function handleError(error: any, context: string) {
  let errorMessage = 'An error occurred';

  if (error.message && error.message.includes('Access-Control-Allow-Origin')) {
    errorMessage = 'A CORS error occurred';
  }

  switch (context) {
    case 'data':
      errorMessage = 'Error fetching data';
      break;
    case 'anime episodes':
      errorMessage = 'Error fetching anime episodes';
      break;
  }

  if (error.response) {
    const status = error.response.status;
    if (status >= 500) {
      errorMessage += ': Server error';
    } else if (status >= 400) {
      errorMessage += ': Client error';
    }
    errorMessage += `: ${error.response.data.message || 'Unknown error'}`;
  } else if (error.message) {
    errorMessage += `: ${error.message}`;
  }

  console.error(`${errorMessage}`, error);
  throw new Error(errorMessage);
}

function generateCacheKey(...args: string[]) {
  return args.join('-');
}

interface CacheItem {
  value: any;
  timestamp: number;
}

function createOptimizedSessionStorageCache(
  maxSize: number,
  maxAge: number,
  cacheKey: string,
) {
  const cache = new Map<string, CacheItem>(
    JSON.parse(sessionStorage.getItem(cacheKey) || '[]'),
  );
  const keys = new Set<string>(cache.keys());

  function isItemExpired(item: CacheItem) {
    return Date.now() - item.timestamp > maxAge;
  }

  function updateSessionStorage() {
    sessionStorage.setItem(
      cacheKey,
      JSON.stringify(Array.from(cache.entries())),
    );
  }

  return {
    get(key: string) {
      if (cache.has(key)) {
        const item = cache.get(key);
        if (!isItemExpired(item!)) {
          keys.delete(key);
          keys.add(key);
          return item!.value;
        }
        cache.delete(key);
        keys.delete(key);
      }
      return undefined;
    },
    set(key: string, value: any) {
      if (cache.size >= maxSize) {
        const oldestKey = keys.values().next().value as string;
        cache.delete(oldestKey);
        keys.delete(oldestKey);
      }
      keys.add(key);
      cache.set(key, { value, timestamp: Date.now() });
      updateSessionStorage();
    },
  };
}

const CACHE_SIZE = 20;
const CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

function createCache(cacheKey: string) {
  return createOptimizedSessionStorageCache(
    CACHE_SIZE,
    CACHE_MAX_AGE,
    cacheKey,
  );
}

interface FetchOptions {
  type?: string;
  season?: string;
  format?: string;
  sort?: string[];
  genres?: string[];
  id?: string;
  year?: string;
  status?: string;
}

const advancedSearchCache = createCache('Advanced Search');
const animeDataCache = createCache('Data');
const animeInfoCache = createCache('Info');
const animeEpisodesCache = createCache('Episodes');
const fetchAnimeEmbeddedEpisodesCache = createCache('Video Embedded Sources');
const videoSourcesCache = createCache('Video Sources');
const genreCache = createCache('AniListGenres');

// ─────────────────────────────────────────────────────────────────────────────
// M3U8 Proxy Utilities
// ─────────────────────────────────────────────────────────────────────────────

const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Builds a proxied m3u8 URL with spoofed Referer/Origin headers.
 *
 * @param sourceUrl  The raw .m3u8 URL
 * @param referer    The page the stream originates from (e.g. the iframe URL)
 * @returns          Proxied URL string, or original URL if proxy is not configured
 */
export function buildM3U8ProxyUrl(sourceUrl: string, referer: string): string {
  if (!M3U8_PROXY_URL) {
    console.warn('⚠️ VITE_M3U8_PROXY_URL is not set. Returning original URL.');
    return sourceUrl;
  }

  if (!isValidUrl(sourceUrl)) {
    console.warn(`⚠️ Invalid source URL: ${sourceUrl}. Returning as-is.`);
    return sourceUrl;
  }

  const proxyBase = M3U8_PROXY_URL.replace(/\/$/, '');
  const origin = new URL(referer).origin;

  const proxyHeaders = JSON.stringify({
    Referer: referer,
    Origin: origin,
  });

  const proxied = `${proxyBase}/m3u8-proxy?url=${encodeURIComponent(sourceUrl)}&headers=${encodeURIComponent(proxyHeaders)}`;
  console.log(`🔀 M3U8 proxied: ${sourceUrl} → ${proxied}`);
  return proxied;
}

/**
 * Processes a sources array and replaces raw .m3u8 URLs with proxied ones.
 * Non-m3u8 sources are returned as-is.
 *
 * @param sources   Array of source objects with a `url` field
 * @param referer   Referer to spoof (typically the player/iframe URL)
 * @returns         Sources array with proxied URLs
 */
export function proxyM3U8Sources(sources: any[], referer: string): any[] {
  if (!M3U8_PROXY_URL) return sources;

  return sources.map((source) => {
    if (source.url?.endsWith('.m3u8') && isValidUrl(source.url)) {
      return {
        ...source,
        url: buildM3U8ProxyUrl(source.url, referer),
      };
    }
    return source;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// AniList GraphQL — Genres
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all available genres from AniList GraphQL API.
 * Returns a cached array of genre strings.
 */
export async function fetchAniListGenres(): Promise<string[]> {
  const cacheKey = 'genres';

  const cached = genreCache.get(cacheKey);
  if (cached) {
    console.log('✅ AniList genres cache HIT');
    return cached as string[];
  }

  console.log('🌐 Fetching genres from AniList...');

  try {
    const response = await fetch(ANILIST_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        query: GENRE_QUERY,
      }),
    });

    if (!response.ok) {
      throw new Error(`AniList GraphQL error: HTTP ${response.status}`);
    }

    const json = await response.json();

    if (json.errors) {
      console.error('AniList GraphQL errors:', json.errors);
      throw new Error(json.errors[0]?.message ?? 'AniList GraphQL error');
    }

    const genres = json?.data?.genres ?? [];
    console.log(`✅ AniList genres: ${genres.length} genres fetched`);

    genreCache.set(cacheKey, genres);
    return genres;
  } catch (error) {
    console.error('❌ Failed to fetch AniList genres:', error);
    return [];
  }
}

async function fetchFromProxy(url: string, cache: any, cacheKey: string) {
  try {
    const cachedResponse = cache.get(cacheKey);
    if (cachedResponse) {
      console.log(`✅ Cache HIT for: ${cacheKey}`);
      return cachedResponse;
    }

    console.log(`❌ Cache MISS for: ${cacheKey}. Making network request...`);

    const requestConfig = PROXY_URL ? { params: { url } } : {};
    const response = await axiosInstance.get(
      PROXY_URL ? '' : url,
      requestConfig,
    );

    if (
      response.status !== 200 ||
      (response.data.statusCode && response.data.statusCode >= 400)
    ) {
      const errorMessage = response.data.message || 'Unknown server error';
      throw new Error(
        `Server error: ${response.data.statusCode || response.status} ${errorMessage}`,
      );
    }

    cache.set(cacheKey, response.data);
    return response.data;
  } catch (error) {
    handleError(error, 'data');
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AniList GraphQL — Airing Schedule
// ─────────────────────────────────────────────────────────────────────────────

const AIRING_SCHEDULE_QUERY = `
  query AiringSchedule($airingAt_greater: Int, $airingAt_lesser: Int, $page: Int) {
    Page(page: $page, perPage: 50) {
      pageInfo {
        hasNextPage
        currentPage
        total
      }
      airingSchedules(
        airingAt_greater: $airingAt_greater
        airingAt_lesser: $airingAt_lesser
        sort: TIME
      ) {
        id
        airingAt
        episode
        media {
          id
          idMal
          title {
            romaji
            english
            native
            userPreferred
          }
          coverImage {
            large
            medium
            color
          }
          bannerImage
          description
          status
          averageScore
          genres
          duration
          type
          format
          countryOfOrigin
          isAdult
        }
      }
    }
  }
`;

export interface AniListAiringItem {
  id: number;
  airingAt: number;
  episode: number;
  media: {
    id: number;
    idMal: number | null;
    title: {
      romaji: string;
      english: string | null;
      native: string;
      userPreferred: string;
    };
    coverImage: {
      large: string;
      medium: string;
      color: string | null;
    };
    bannerImage: string | null;
    description: string | null;
    status: string;
    averageScore: number | null;
    genres: string[];
    duration: number | null;
    type: string;
    format: string;
    countryOfOrigin: string;
    isAdult: boolean;
  };
}

/**
 * Get the Unix timestamp boundaries (seconds) for the START and END of a local
 * calendar day offset from today.
 */
function getLocalDayBounds(dayOffset: number): { start: number; end: number } {
  const now = new Date();

  const target = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + dayOffset,
    0, 0, 0, 0,
  );

  const startOfDay = new Date(target);
  const endOfDay = new Date(target);
  endOfDay.setHours(23, 59, 59, 999);

  return {
    start: Math.floor(startOfDay.getTime() / 1000),
    end: Math.floor(endOfDay.getTime() / 1000),
  };
}

/**
 * Fetch the airing schedule for a given day offset from today using the
 * official AniList GraphQL API.
 *
 * @param dayOffset  0 = today (local timezone), 1 = tomorrow, …, 6 = 6 days out
 * @returns          Flat array of AniListAiringItem sorted by airingAt (asc)
 */
export async function fetchAiringSchedule(
  dayOffset: number = 0,
): Promise<AniListAiringItem[]> {
  const { start, end } = getLocalDayBounds(dayOffset);

  const localDateLabel = new Date(start * 1000).toLocaleDateString('en-CA');
  const cacheKey = generateCacheKey('anilistAiring', localDateLabel);
  const airingCache = createCache('AniListAiringSchedule');

  const cached = airingCache.get(cacheKey);
  if (cached) {
    console.log(`✅ AniList airing cache HIT: ${cacheKey}`);
    return cached as AniListAiringItem[];
  }

  console.log(
    `🌐 AniList airing fetch — dayOffset: ${dayOffset}, range: ${new Date(start * 1000).toISOString()} → ${new Date(end * 1000).toISOString()}`,
  );

  const allItems: AniListAiringItem[] = [];
  let page = 1;
  let hasNextPage = true;

  while (hasNextPage && page <= 10) {
    try {
      const response = await fetch(ANILIST_GRAPHQL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          query: AIRING_SCHEDULE_QUERY,
          variables: {
            airingAt_greater: start - 1,
            airingAt_lesser: end,
            page,
          },
        }),
      });

      if (response.status === 429) {
        console.warn('⚠️ AniList rate limit hit, waiting 2 s…');
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }

      if (!response.ok) {
        throw new Error(`AniList GraphQL error: HTTP ${response.status}`);
      }

      const json = await response.json();

      if (json.errors) {
        console.error('AniList GraphQL errors:', json.errors);
        throw new Error(json.errors[0]?.message ?? 'AniList GraphQL error');
      }

      const pageData = json?.data?.Page;
      if (!pageData) break;

      const schedules: AniListAiringItem[] = (pageData.airingSchedules ?? [])
        .filter((s: any) => !s.media?.isAdult);

      allItems.push(...schedules);

      hasNextPage = pageData.pageInfo?.hasNextPage ?? false;
      page++;
    } catch (err) {
      console.error(`❌ AniList page ${page} fetch failed:`, err);
      break;
    }
  }

  allItems.sort((a, b) => a.airingAt - b.airingAt);

  console.log(`✅ AniList airing: ${allItems.length} items for offset ${dayOffset}`);
  airingCache.set(cacheKey, allItems);
  return allItems;
}

// ─────────────────────────────────────────────────────────────────────────────
// All existing API functions
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchAdvancedSearch(
  searchQuery: string = '',
  page: number = 1,
  perPage: number = 20,
  options: FetchOptions = {},
) {
  const queryParams = new URLSearchParams({
    ...(searchQuery && { query: searchQuery }),
    page: page.toString(),
    perPage: perPage.toString(),
    type: options.type ?? 'ANIME',
    ...(options.season && { season: options.season }),
    ...(options.format && { format: options.format }),
    ...(options.id && { id: options.id }),
    ...(options.year && { year: options.year }),
    ...(options.status && { status: options.status }),
    ...(options.sort && { sort: JSON.stringify(options.sort) }),
  });

  if (options.genres && options.genres.length > 0) {
    queryParams.set('genres', JSON.stringify(options.genres));
  }
  const url = `${BASE_URL}meta/anilist/advanced-search?${queryParams.toString()}`;
  const cacheKey = generateCacheKey('advancedSearch', queryParams.toString());
  return fetchFromProxy(url, advancedSearchCache, cacheKey);
}

export async function fetchAnimeData(
  animeId: string,
  provider: string = 'kickassanime',
) {
  const finalProvider = provider || 'kickassanime';
  const params = new URLSearchParams({ provider: finalProvider });
  const url = `${BASE_URL}meta/anilist/data/${animeId}?${params.toString()}`;
  const cacheKey = generateCacheKey('animeData', animeId, finalProvider);
  return fetchFromProxy(url, animeDataCache, cacheKey);
}

export async function fetchAnimeInfo(
  animeId: string,
  provider: string = 'kickassanime',
) {
  const finalProvider = provider || 'kickassanime';
  const params = new URLSearchParams({ provider: finalProvider });
  const url = `${BASE_URL}meta/anilist/info/${animeId}?${params.toString()}`;
  const cacheKey = generateCacheKey('animeInfo', animeId, finalProvider);
  return fetchFromProxy(url, animeInfoCache, cacheKey);
}

async function fetchList(
  type: string,
  page: number = 1,
  perPage: number = 16,
  options: FetchOptions = {},
) {
  let cacheKey: string;
  let url: string;
  const params = new URLSearchParams({
    page: page.toString(),
    perPage: perPage.toString(),
  });

  if (
    ['TopRated', 'Trending', 'Popular', 'TopAiring', 'Upcoming'].includes(type)
  ) {
    cacheKey = generateCacheKey(
      `${type}Anime`,
      page.toString(),
      perPage.toString(),
    );
    url = `${BASE_URL}meta/anilist/${type.toLowerCase()}`;

    if (type === 'TopRated') {
      options = { type: 'ANIME', sort: ['["SCORE_DESC"]'] };
      url = `${BASE_URL}meta/anilist/advanced-search?type=${options.type}&sort=${options.sort}&`;
    } else if (type === 'Popular') {
      options = { type: 'ANIME', sort: ['["POPULARITY_DESC"]'] };
      url = `${BASE_URL}meta/anilist/advanced-search?type=${options.type}&sort=${options.sort}&`;
    } else if (type === 'Upcoming') {
      const season = getNextSeason();
      options = {
        type: 'ANIME',
        season,
        year: year.toString(),
        status: 'NOT_YET_RELEASED',
        sort: ['["POPULARITY_DESC"]'],
      };
      url = `${BASE_URL}meta/anilist/advanced-search?type=${options.type}&status=${options.status}&sort=${options.sort}&season=${options.season}&year=${options.year}&`;
    } else if (type === 'TopAiring') {
      const season = getCurrentSeason();
      options = {
        type: 'ANIME',
        season,
        year: year.toString(),
        status: 'RELEASING',
        sort: ['["POPULARITY_DESC"]'],
      };
      url = `${BASE_URL}meta/anilist/advanced-search?type=${options.type}&status=${options.status}&sort=${options.sort}&season=${options.season}&year=${options.year}&`;
    }
  } else {
    cacheKey = generateCacheKey(
      `${type}Anime`,
      page.toString(),
      perPage.toString(),
    );
    url = `${BASE_URL}meta/anilist/${type.toLowerCase()}`;
  }

  const specificCache = createCache(`${type}`);
  return fetchFromProxy(`${url}?${params.toString()}`, specificCache, cacheKey);
}

export const fetchTopAnime = (page: number, perPage: number) =>
  fetchList('TopRated', page, perPage);
export const fetchTrendingAnime = (page: number, perPage: number) =>
  fetchList('Trending', page, perPage);
export const fetchPopularAnime = (page: number, perPage: number) =>
  fetchList('Popular', page, perPage);
export const fetchTopAiringAnime = (page: number, perPage: number) =>
  fetchList('TopAiring', page, perPage);
export const fetchUpcomingSeasons = (page: number, perPage: number) =>
  fetchList('Upcoming', page, perPage);

export async function fetchAnimeEpisodes(
  animeId: string,
  provider: string = 'kickassanime',
  dub: boolean = false,
) {
  const finalProvider = provider || 'kickassanime';
  const params = new URLSearchParams({
    provider: finalProvider,
    dub: dub ? 'true' : 'false',
  });
  const url = `${BASE_URL}meta/anilist/episodes/${animeId}?${params.toString()}`;
  const cacheKey = generateCacheKey(
    'animeEpisodes',
    animeId,
    finalProvider,
    dub ? 'dub' : 'sub',
  );
  return fetchFromProxy(url, animeEpisodesCache, cacheKey);
}

export async function fetchAnimeEmbeddedEpisodes(
  episodeId: string,
  provider: string = 'kickassanime',
) {
  const finalProvider = provider || 'kickassanime';
  const params = new URLSearchParams({ provider: finalProvider });
  const url = `${BASE_URL}meta/anilist/servers/${episodeId}?${params.toString()}`;
  const cacheKey = generateCacheKey(
    'animeEmbeddedServers',
    episodeId,
    finalProvider,
  );
  return fetchFromProxy(url, fetchAnimeEmbeddedEpisodesCache, cacheKey);
}

export async function fetchAnimeStreamingLinks(
  episodeId: string,
  provider: string = 'kickassanime',
  server?: string,
) {
  const finalProvider = provider || 'kickassanime';
  const params = new URLSearchParams({ episodeId, provider: finalProvider });
  if (server) params.append('server', server);
  const url = `${BASE_URL}meta/anilist/watch?${params.toString()}`;
  const cacheKey = generateCacheKey(
    'animeStreamingLinks',
    episodeId,
    finalProvider,
    server || '',
  );
  return fetchFromProxy(url, videoSourcesCache, cacheKey);
}

/**
 * Fetches anime streaming links and automatically proxies any .m3u8 sources.
 * Use this as a drop-in replacement for fetchAnimeStreamingLinks when you need
 * proxied HLS streams.
 *
 * @param episodeId   Episode ID
 * @param provider    Provider name (default: kickassanime)
 * @param server      Optional server override
 * @param referer     Referer URL to spoof in the proxy headers (e.g. iframe URL)
 */
export async function fetchAnimeStreamingLinksProxied(
  episodeId: string,
  provider: string = 'kickassanime',
  server?: string,
  referer?: string,
) {
  const data = await fetchAnimeStreamingLinks(episodeId, provider, server);

  if (!M3U8_PROXY_URL) {
    console.warn('⚠️ M3U8 proxy skipped: missing VITE_M3U8_PROXY_URL.');
    return data;
  }

  // Extract server URL from response to use as referer/origin
  let serverUrl = referer;
  if (!serverUrl && data?.servers?.length > 0) {
    // Find the matching server by name if server param was provided
    if (server) {
      const matchingServer = data.servers.find(
        (s: any) => s.name?.toLowerCase() === server.toLowerCase()
      );
      if (matchingServer?.url) {
        serverUrl = matchingServer.url;
      }
    }
    // Fallback to first server if no specific server was requested
    if (!serverUrl && data.servers[0]?.url) {
      serverUrl = data.servers[0].url;
    }
  }

  if (!serverUrl) {
    console.warn('⚠️ M3U8 proxy skipped: no server URL available.');
    return data;
  }

  console.log('[fetchAnimeStreamingLinksProxied] Using server URL as referer:', serverUrl);

  if (Array.isArray(data?.sources)) {
    data.sources = proxyM3U8Sources(data.sources, serverUrl);
  }

  return data;
}

interface FetchSkipTimesParams {
  malId: string;
  episodeNumber: string;
  episodeLength?: string;
}

export async function fetchSkipTimes({
  malId,
  episodeNumber,
  episodeLength = '0',
}: FetchSkipTimesParams) {
  const types = ['ed', 'mixed-ed', 'mixed-op', 'op', 'recap'];
  const url = new URL(`${SKIP_TIMES}v2/skip-times/${malId}/${episodeNumber}`);
  url.searchParams.append('episodeLength', episodeLength.toString());
  types.forEach((type) => url.searchParams.append('types[]', type));
  const cacheKey = generateCacheKey(
    'skipTimes',
    malId,
    episodeNumber,
    episodeLength || '',
  );
  return fetchFromProxy(url.toString(), createCache('SkipTimes'), cacheKey);
}

export async function fetchRecentEpisodes(
  page: number = 1,
  perPage: number = 18,
  provider: string = 'kickassanime',
) {
  const params = new URLSearchParams({
    page: page.toString(),
    perPage: perPage.toString(),
    provider,
  });
  const url = `${BASE_URL}meta/anilist/recent-episodes?${params.toString()}`;
  const cacheKey = generateCacheKey(
    'recentEpisodes',
    page.toString(),
    perPage.toString(),
    provider,
  );
  return fetchFromProxy(url, createCache('RecentEpisodes'), cacheKey);
}

export async function fetchStudio(
  studioId: string,
  page: number = 1,
  perPage: number = 20,
  provider: string = 'kickassanime',
) {
  const finalProvider = provider || 'kickassanime';
  const params = new URLSearchParams({
    page: page.toString(),
    perPage: perPage.toString(),
    provider: finalProvider,
  });
  const url = `${BASE_URL}meta/anilist/studio/${studioId}?${params.toString()}`;
  const cacheKey = generateCacheKey(
    'studio',
    studioId,
    page.toString(),
    perPage.toString(),
    finalProvider,
  );
  return fetchFromProxy(url, createCache('Studio'), cacheKey);
}

export interface JikanProducer {
  mal_id: number;
  url: string;
  titles: Array<{
    type: string;
    title: string;
  }>;
  images: {
    jpg: {
      image_url: string;
    };
  };
  favorites: number;
  established: string | null;
  about: string | null;
  count: number;
}

export async function fetchStudioJikan(studioId: string): Promise<JikanProducer | null> {
  const cacheKey = generateCacheKey('studioJikan', studioId);
  const jikanCache = createCache('StudioJikan');

  const cached = jikanCache.get(cacheKey);
  if (cached) {
    console.log(`✅ Jikan studio cache HIT: ${cacheKey}`);
    return cached as JikanProducer;
  }

  console.log(`🌐 Jikan studio fetch for ID: ${studioId}`);

  try {
    const response = await axios.get(
      `https://api.jikan.moe/v4/producers/${studioId}`,
      { timeout: 10000 }
    );

    if (response.status === 200 && response.data?.data) {
      const producerData = response.data.data as JikanProducer;
      jikanCache.set(cacheKey, producerData);
      return producerData;
    }
    return null;
  } catch (error) {
    console.error(`❌ Jikan studio fetch failed for ID ${studioId}:`, error);
    return null;
  }
}