import axios from 'axios';
import { year, getCurrentSeason, getNextSeason } from '../index';
import { cacheManager } from '../lib/caching';

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

// M3U8 Proxy configuration
const M3U8_PROXY_URL = import.meta.env.VITE_M3U8_PROXY_URL as string;
const M3U8_PROXY_URL_2 = import.meta.env.VITE_M3U8_PROXY_URL_2 as string;

// Image Proxy configuration (Cloudflare Worker)
const IMAGE_PROXY_URL = import.meta.env.VITE_IMAGE_PROXY_URL as string;

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

  console.error(`${errorMessage}`);
  throw new Error(errorMessage);
}

function generateCacheKey(...args: string[]) {
  return args.join('-');
}

function buildQueryString(params: URLSearchParams) {
  return params.toString().replace(/%2F/g, '/');
}

export type MangaProvider =
  | 'mangadex'
  | 'mangahere'
  | 'mangakakalot'
  | 'mangapark'
  | 'mangapill'
  | 'mangareader'
  | 'mangasee123';

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
 */
export function buildM3U8ProxyUrl(
  sourceUrl: string,
  referer: string,
  proxyUrl?: string,
  includeHeaders: boolean = true,
): string {
  const selectedProxy = proxyUrl || M3U8_PROXY_URL;

  if (!selectedProxy) {
    console.warn('⚠️ No M3U8 proxy is configured. Returning original URL.');
    return sourceUrl;
  }

  if (sourceUrl.includes(selectedProxy)) {
    return sourceUrl;
  }

  if (!isValidUrl(sourceUrl)) {
    console.warn(`⚠️ Invalid source URL. Returning as-is.`);
    return sourceUrl;
  }

  const proxyBase = selectedProxy.replace(/\/$/, '');
  let proxied = `${proxyBase}/m3u8-proxy?url=${encodeURIComponent(sourceUrl)}`;

  if (includeHeaders) {
    const origin = new URL(referer).origin;
    const proxyHeaders = JSON.stringify({
      Referer: referer,
      Origin: origin,
    });
    proxied += `&headers=${encodeURIComponent(proxyHeaders)}`;
  }

  return proxied;
}

/**
 * Processes a sources array and replaces raw .m3u8 URLs with proxied ones.
 */
export function proxyM3U8Sources(
  sources: any[],
  referer: string,
  proxyUrl?: string,
  includeHeaders: boolean = true,
): any[] {
  const selectedProxy = proxyUrl || M3U8_PROXY_URL;
  if (!selectedProxy) return sources;

  return sources.map((source) => {
    if (source.url?.endsWith('.m3u8') && isValidUrl(source.url)) {
      if (source.url.includes(selectedProxy)) {
        return source;
      }
      return {
        ...source,
        url: buildM3U8ProxyUrl(source.url, referer, proxyUrl, includeHeaders),
      };
    }
    return source;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Image Proxy Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a proxied image URL using the Cloudflare Worker.
 */
export function buildImageProxyUrl(
  imageUrl: string,
  provider: string = 'mangahere',
  referer?: string,
): string {
  if (!IMAGE_PROXY_URL) {
    console.warn('⚠️ No image proxy is configured. Returning original URL.');
    return imageUrl;
  }

  if (imageUrl.includes(IMAGE_PROXY_URL)) {
    return imageUrl;
  }

  if (!isValidUrl(imageUrl)) {
    console.warn(`⚠️ Invalid image URL. Returning as-is.`);
    return imageUrl;
  }

  const proxyBase = IMAGE_PROXY_URL.replace(/\/$/, '');
  let proxied = `${proxyBase}/?url=${encodeURIComponent(imageUrl)}&provider=${encodeURIComponent(provider)}`;

  if (referer) {
    proxied += `&referer=${encodeURIComponent(referer)}`;
  }

  return proxied;
}

// ─────────────────────────────────────────────────────────────────────────────
// AniList GraphQL — Genres
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchAniListGenres(): Promise<string[]> {
  const cacheKey = 'genres';

  const cached = await cacheManager.get<string[]>('AniListGenres', cacheKey);
  if (cached) {
    console.log('✅ AniList genres cache HIT');
    return cached;
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
      console.error('AniList GraphQL error');
      throw new Error(json.errors[0]?.message ?? 'AniList GraphQL error');
    }

    const genres = json?.data?.genres ?? [];
    console.log(`✅ AniList genres: ${genres.length} genres fetched`);

    // Only cache if we have valid genres
    if (genres.length > 0) {
      await cacheManager.set('AniListGenres', cacheKey, genres);
    } else {
      console.log(`⚠️ Skipping cache for AniListGenres ${cacheKey} - no valid genres`);
    }

    return genres;
  } catch (error) {
    console.error('❌ Failed to fetch AniList genres:', error);
    return [];
  }
}

async function fetchFromProxy(
  url: string,
  cacheKeyName: string,
  cacheKey: string,
  requestTimeout?: number,
) {
  try {
    // Use fetchWithCache for automatic deduplication of concurrent requests
    const { data } = await cacheManager.fetchWithCache(
      cacheKeyName,
      cacheKey,
      async () => {
        const requestConfig: any = { timeout: requestTimeout };
        if (PROXY_URL) {
          requestConfig.params = { url };
        }

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

        // Only cache valid, non-empty responses
        if (!response.data || Object.keys(response.data).length === 0) {
          throw new Error('Empty or invalid response data');
        }

        return response.data;
      },
    );

    return data;
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

export async function fetchAiringSchedule(
  dayOffset: number = 0,
): Promise<AniListAiringItem[]> {
  const { start, end } = getLocalDayBounds(dayOffset);

  const localDateLabel = new Date(start * 1000).toLocaleDateString('en-CA');
  const cacheKey = generateCacheKey('anilistAiring', localDateLabel);

  const cached = await cacheManager.get<AniListAiringItem[]>(
    'Airing Schedule',
    cacheKey,
  );
  if (cached) {
    console.log(`✅ AniList airing cache HIT: ${cacheKey}`);
    return cached;
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
        console.error('AniList GraphQL error');
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

  // Only cache if we have valid items
  if (allItems.length > 0) {
    await cacheManager.set('Airing Schedule', cacheKey, allItems);

    // Set up auto-refresh for airing schedule
    const refreshFn = () => fetchAiringSchedule(dayOffset);
    cacheManager.setupAutoRefresh('Airing Schedule', cacheKey, refreshFn);
  } else {
    console.log(`⚠️ Skipping cache for Airing Schedule ${cacheKey} - no valid items`);
  }

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
  return fetchFromProxy(url, 'Advanced Search', cacheKey);
}

export async function fetchAnimeData(
  animeId: string,
  provider: string = 'kickassanime',
) {
  const finalProvider = provider || 'kickassanime';
  const params = new URLSearchParams({ provider: finalProvider });
  const url = `${BASE_URL}meta/anilist/data/${animeId}?${params.toString()}`;
  const cacheKey = generateCacheKey('animeData', animeId, finalProvider);

  try {
    const data = await fetchFromProxy(url, 'Data', cacheKey);

    if ((!data || (typeof data === 'object' && Object.keys(data).length === 0)) && finalProvider !== 'animekai') {
      console.log(`⚠️ No data from ${finalProvider}, trying animekai...`);
      const fallbackParams = new URLSearchParams({ provider: 'animekai' });
      const fallbackUrl = `${BASE_URL}meta/anilist/data/${animeId}?${fallbackParams.toString()}`;
      const fallbackCacheKey = generateCacheKey('animeData', animeId, 'animekai');
      return await fetchFromProxy(fallbackUrl, 'Data', fallbackCacheKey);
    }

    return data;
  } catch (error) {
    if (finalProvider !== 'animekai') {
      console.log(`⚠️ Error from ${finalProvider}, trying animekai...`, error);
      const fallbackParams = new URLSearchParams({ provider: 'animekai' });
      const fallbackUrl = `${BASE_URL}meta/anilist/data/${animeId}?${fallbackParams.toString()}`;
      const fallbackCacheKey = generateCacheKey('animeData', animeId, 'animekai');
      return await fetchFromProxy(fallbackUrl, 'Data', fallbackCacheKey);
    }
    throw error;
  }
}

export async function fetchAnimeInfo(
  animeId: string,
  provider: string = 'kickassanime',
) {
  const finalProvider = provider || 'kickassanime';
  const params = new URLSearchParams({ provider: finalProvider });
  const url = `${BASE_URL}meta/anilist/info/${animeId}?${params.toString()}`;
  const cacheKey = generateCacheKey('animeInfo', animeId, finalProvider);

  try {
    const info = await fetchFromProxy(url, 'Info', cacheKey);

    if ((!info || (typeof info === 'object' && Object.keys(info).length === 0)) && finalProvider !== 'animekai') {
      console.log(`⚠️ No info from ${finalProvider}, trying animekai...`);
      const fallbackParams = new URLSearchParams({ provider: 'animekai' });
      const fallbackUrl = `${BASE_URL}meta/anilist/info/${animeId}?${fallbackParams.toString()}`;
      const fallbackCacheKey = generateCacheKey('animeInfo', animeId, 'animekai');
      return await fetchFromProxy(fallbackUrl, 'Info', fallbackCacheKey);
    }

    return info;
  } catch (error) {
    if (finalProvider !== 'animekai') {
      console.log(`⚠️ Error from ${finalProvider}, trying animekai...`, error);
      const fallbackParams = new URLSearchParams({ provider: 'animekai' });
      const fallbackUrl = `${BASE_URL}meta/anilist/info/${animeId}?${fallbackParams.toString()}`;
      const fallbackCacheKey = generateCacheKey('animeInfo', animeId, 'animekai');
      return await fetchFromProxy(fallbackUrl, 'Info', fallbackCacheKey);
    }
    throw error;
  }
}

/**
 * Fetches manga info for a SPECIFIC provider without any internal fallback.
 *
 * This is intentionally strict — callers (e.g. Info.tsx) are responsible for
 * probing multiple providers and deciding which to use. Silent internal
 * fallbacks would cause the caller to believe provider A returned data when
 * it was actually provider B, leading to wrong chapter URLs.
 *
 * Throws if the provider returns no data or an error, so the caller can
 * handle it via Promise.allSettled / try-catch.
 */
export async function fetchMangaInfo(
  mangaId: string,
  provider: 'mangahere' | 'mangapill' = 'mangahere',
): Promise<any> {
  const finalProvider = provider || 'mangahere';
  const params = new URLSearchParams({ provider: finalProvider });
  const url = `${BASE_URL}meta/anilist-manga/info/${mangaId}?${params.toString()}`;
  const cacheKey = generateCacheKey('mangaInfo', mangaId, finalProvider);

  const info = await fetchFromProxy(url, 'Info', cacheKey);

  // Throw so the caller (Info.tsx parallel probe) can detect this provider
  // has no data, rather than silently returning empty-or-wrong data.
  if (!info || (typeof info === 'object' && Object.keys(info).length === 0)) {
    throw new Error(`No manga info returned from provider: ${finalProvider}`);
  }

  return info;
}

export interface MangaReadPage {
  page: number;
  img: string;
  headerForImage?: {
    Referer: string;
  };
}

export async function fetchMangaRead(
  chapterId: string,
  provider: 'mangahere' | 'mangapill' = 'mangahere',
): Promise<MangaReadPage[]> {
  const finalProvider = provider || 'mangahere';
  const params = new URLSearchParams({ chapterId, provider: finalProvider });
  const url = `${BASE_URL}meta/anilist-manga/read?${buildQueryString(params)}`;
  const cacheKey = generateCacheKey('mangaRead', chapterId, finalProvider);
  const requestTimeout = 25000;

  const data = await fetchFromProxy(url, 'MangaRead', cacheKey, requestTimeout);

  if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
    throw new Error(`No manga read pages available for provider ${finalProvider}`);
  }

  return data as MangaReadPage[];
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

  const specificCache = type;
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

  const attachProvider = (items: any, providerName: string) => {
    if (Array.isArray(items)) {
      return items.map((item) => ({ ...item, provider: providerName }));
    }
    return items;
  };

  try {
    const episodes = attachProvider(
      await fetchFromProxy(url, 'Episodes', cacheKey),
      finalProvider,
    );

    if (
      (!episodes ||
        (Array.isArray(episodes) && episodes.length === 0) ||
        (typeof episodes === 'object' && Object.keys(episodes).length === 0)) &&
      finalProvider !== 'animekai'
    ) {
      console.log(`⚠️ No episodes from ${finalProvider}, trying animekai...`);
      const fallbackParams = new URLSearchParams({
        provider: 'animekai',
        dub: dub ? 'true' : 'false',
      });
      const fallbackUrl = `${BASE_URL}meta/anilist/episodes/${animeId}?${fallbackParams.toString()}`;
      const fallbackCacheKey = generateCacheKey(
        'animeEpisodes',
        animeId,
        'animekai',
        dub ? 'dub' : 'sub',
      );
      return attachProvider(
        await fetchFromProxy(fallbackUrl, 'Episodes', fallbackCacheKey),
        'animekai',
      );
    }

    return episodes;
  } catch (error) {
    if (finalProvider !== 'animekai') {
      console.log(`⚠️ Error from ${finalProvider}, trying animekai...`, error);
      const fallbackParams = new URLSearchParams({
        provider: 'animekai',
        dub: dub ? 'true' : 'false',
      });
      const fallbackUrl = `${BASE_URL}meta/anilist/episodes/${animeId}?${fallbackParams.toString()}`;
      const fallbackCacheKey = generateCacheKey(
        'animeEpisodes',
        animeId,
        'animekai',
        dub ? 'dub' : 'sub',
      );
      return attachProvider(
        await fetchFromProxy(fallbackUrl, 'Episodes', fallbackCacheKey),
        'animekai',
      );
    }
    throw error;
  }
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
  return fetchFromProxy(url, 'Video Embedded Sources', cacheKey);
}

export async function fetchAnimeStreamingLinks(
  episodeId: string,
  provider: string = 'kickassanime',
  server?: string,
) {
  const finalProvider = provider || 'kickassanime';
  const params = new URLSearchParams({ episodeId, provider: finalProvider });
  const url = `${BASE_URL}meta/anilist/watch?${params.toString()}`;
  const cacheKey = generateCacheKey(
    'animeStreamingLinks',
    episodeId,
    finalProvider,
    server || '',
  );
  return fetchFromProxy(url, 'Video Sources', cacheKey);
}

export async function fetchAnimeStreamingLinksProxied(
  episodeId: string,
  provider: string = 'kickassanime',
  server?: string,
  referer?: string,
) {
  const finalProvider = provider || 'kickassanime';
  const data = await fetchAnimeStreamingLinks(episodeId, finalProvider, server);

  const proxyUrl = finalProvider === 'animekai'
    ? M3U8_PROXY_URL_2 || M3U8_PROXY_URL
    : M3U8_PROXY_URL;

  if (!proxyUrl) {
    console.warn('⚠️ M3U8 proxy skipped: missing proxy configuration.');
    return data;
  }

  if (finalProvider === 'animekai' && !M3U8_PROXY_URL_2) {
    console.warn(
      '⚠️ Animekai is using the fallback M3U8 proxy because VITE_M3U8_PROXY_URL_2 is not set.',
    );
  }

  const ANIKAI_REFERER = 'https://anikai.to';

  let serverUrl = finalProvider === 'animekai' ? ANIKAI_REFERER : referer;
  if (!serverUrl && data?.servers?.length > 0) {
    if (server) {
      const matchingServer = data.servers.find(
        (s: any) => s.name?.toLowerCase() === server.toLowerCase(),
      );
      if (matchingServer?.url) {
        serverUrl = matchingServer.url;
      }
    }
    if (!serverUrl && data.servers[0]?.url) {
      serverUrl = data.servers[0].url;
    }
  }

  if (!serverUrl) {
    console.warn('⚠️ M3U8 proxy skipped: no server URL available.');
    return data;
  }

  console.log(
    `[fetchAnimeStreamingLinksProxied] Using server URL as referer: ${serverUrl} (provider=${finalProvider})`,
  );

  if (Array.isArray(data?.sources)) {
    data.sources = proxyM3U8Sources(
      data.sources,
      serverUrl,
      proxyUrl,
      true,
    );
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
  return fetchFromProxy(url.toString(), 'SkipTimes', cacheKey);
}

export async function fetchRecentEpisodes(
  page: number = 1,
  perPage: number = 24,
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
  return fetchFromProxy(url, 'Recent Episodes', cacheKey);
}

export async function fetchRecentEpisodesWithFallback(
  page: number = 1,
  perPage: number = 24,
) {
  try {
    return await fetchRecentEpisodes(page, perPage, 'kickassanime');
  } catch (error) {
    console.warn('kickassanime failed for recent episodes, trying animekai');
    return await fetchRecentEpisodes(page, perPage, 'animekai');
  }
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
  return fetchFromProxy(url, 'Studio', cacheKey);
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

  const cached = await cacheManager.get<JikanProducer>('Studio', cacheKey);
  if (cached) {
    console.log(`✅ Jikan studio cache HIT: ${cacheKey}`);
    return cached;
  }

  console.log(`🌐 Jikan studio fetch for ID: ${studioId}`);

  try {
    const response = await axios.get(
      `https://api.jikan.moe/v4/producers/${studioId}`,
      { timeout: 10000 }
    );

    if (response.status === 200 && response.data?.data) {
      const producerData = response.data.data as JikanProducer;

      // Only cache if we have valid producer data
      if (producerData && Object.keys(producerData).length > 0) {
        await cacheManager.set('Studio', cacheKey, producerData);
      } else {
        console.log(`⚠️ Skipping cache for Studio ${cacheKey} - invalid producer data`);
      }
      return producerData;
    }
    return null;
  } catch (error) {
    console.error(`❌ Jikan studio fetch failed`);
    return null;
  }
}