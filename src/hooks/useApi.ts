import axios from 'axios';
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

// ─────────────────────────────────────────────────────────────────────────────
// 🧠 Intelligent Season & Year Engine
// Automatically computes the correct AniList season and year at call-time,
// so it's always accurate regardless of when the app was last deployed.
// ─────────────────────────────────────────────────────────────────────────────

type AniListSeason = 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL';

/**
 * Maps a calendar month (1–12) to an AniList season.
 * WINTER  = Jan–Mar  (1,2,3)
 * SPRING  = Apr–Jun  (4,5,6)
 * SUMMER  = Jul–Sep  (7,8,9)
 * FALL    = Oct–Dec  (10,11,12)
 */
function monthToSeason(month: number): AniListSeason {
  if (month <= 3) return 'WINTER';
  if (month <= 6) return 'SPRING';
  if (month <= 9) return 'SUMMER';
  return 'FALL';
}

/**
 * Returns the current AniList season and year based on today's date.
 * Called fresh every time so it always reflects the real current date.
 */
export function getCurrentSeasonInfo(): { season: AniListSeason; year: number } {
  const now = new Date();
  return {
    season: monthToSeason(now.getMonth() + 1),
    year: now.getFullYear(),
  };
}

/**
 * Returns the NEXT AniList season and year.
 * Handles year roll-over automatically (FALL → WINTER of next year).
 */
export function getNextSeasonInfo(): { season: AniListSeason; year: number } {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  if (month <= 3) return { season: 'SPRING', year };
  if (month <= 6) return { season: 'SUMMER', year };
  if (month <= 9) return { season: 'FALL', year };
  return { season: 'WINTER', year: year + 1 }; // FALL → next WINTER
}

/**
 * String helpers kept for backward-compat with Home.tsx / index exports.
 */


// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// AniList GraphQL — Basic Media Info
// ─────────────────────────────────────────────────────────────────────────────

const BASIC_MEDIA_QUERY = `
  query ($id: Int) {
    Media(id: $id) {
      id
      genres
      isAdult
    }
  }
`;

export async function fetchAniListMediaBase(animeId: string): Promise<any> {
  const cacheKey = generateCacheKey('aniListMediaBase', animeId);

  const cached = await cacheManager.get<any>('AniListMediaBase', cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(ANILIST_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        query: BASIC_MEDIA_QUERY,
        variables: { id: parseInt(animeId, 10) },
      }),
    });

    if (!response.ok) {
      throw new Error(`AniList GraphQL error: HTTP ${response.status}`);
    }

    const json = await response.json();

    if (json.errors) {
      throw new Error(json.errors[0]?.message ?? 'AniList GraphQL error');
    }

    const media = json?.data?.Media;
    if (media) {
      await cacheManager.set('AniListMediaBase', cacheKey, media);
    }
    return media;
  } catch (error) {
    console.error(`❌ Failed to fetch AniList Media Base for ${animeId}:`, error);
    return null;
  }
}

async function fetchFromProxy(
  url: string,
  cacheKeyName: string,
  cacheKey: string,
  requestTimeout?: number,
) {
  try {
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

  if (allItems.length > 0) {
    await cacheManager.set('Airing Schedule', cacheKey, allItems);

    const refreshFn = () => fetchAiringSchedule(dayOffset);
    cacheManager.setupAutoRefresh('Airing Schedule', cacheKey, refreshFn);
  } else {
    console.log(`⚠️ Skipping cache for Airing Schedule ${cacheKey} - no valid items`);
  }

  return allItems;
}

// ─────────────────────────────────────────────────────────────────────────────
// Advanced Search
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

// ─────────────────────────────────────────────────────────────────────────────
// 🧠 fetchList — Intelligent URL builder
// Uses URLSearchParams throughout so there is never a double-? or trailing-&
// bug. Season and year are computed fresh at call-time via the season engine.
// ─────────────────────────────────────────────────────────────────────────────

async function fetchList(
  type: string,
  page: number = 1,
  perPage: number = 16,
) {
  const cacheKey = generateCacheKey(
    `${type}Anime`,
    page.toString(),
    perPage.toString(),
  );

  let url: string;

  switch (type) {
    case 'TopAiring': {
      // 🧠 Dynamically resolved at call-time — always the correct season/year
      const { season, year: currentYear } = getCurrentSeasonInfo();
      console.log(`🧠 TopAiring → season: ${season}, year: ${currentYear}`);

      const params = new URLSearchParams({
        type: 'ANIME',
        status: 'RELEASING',
        sort: '["POPULARITY_DESC"]',
        season,
        year: currentYear.toString(),
        page: page.toString(),
        perPage: perPage.toString(),
      });
      url = `${BASE_URL}meta/anilist/advanced-search?${params.toString()}`;
      break;
    }

    case 'Upcoming': {
      // 🧠 Dynamically resolved at call-time — handles year roll-over
      const { season: nextSeason, year: nextYear } = getNextSeasonInfo();
      console.log(`🧠 Upcoming → season: ${nextSeason}, year: ${nextYear}`);

      const params = new URLSearchParams({
        type: 'ANIME',
        status: 'NOT_YET_RELEASED',
        sort: '["POPULARITY_DESC"]',
        season: nextSeason,
        year: nextYear.toString(),
        page: page.toString(),
        perPage: perPage.toString(),
      });
      url = `${BASE_URL}meta/anilist/advanced-search?${params.toString()}`;
      break;
    }

    case 'TopRated': {
      const params = new URLSearchParams({
        type: 'ANIME',
        sort: '["SCORE_DESC"]',
        page: page.toString(),
        perPage: perPage.toString(),
      });
      url = `${BASE_URL}meta/anilist/advanced-search?${params.toString()}`;
      break;
    }

    case 'Popular': {
      const params = new URLSearchParams({
        type: 'ANIME',
        sort: '["POPULARITY_DESC"]',
        page: page.toString(),
        perPage: perPage.toString(),
      });
      url = `${BASE_URL}meta/anilist/advanced-search?${params.toString()}`;
      break;
    }

    // Trending and anything else uses the simple /anilist/<type> endpoint
    default: {
      const params = new URLSearchParams({
        page: page.toString(),
        perPage: perPage.toString(),
      });
      url = `${BASE_URL}meta/anilist/${type.toLowerCase()}?${params.toString()}`;
      break;
    }
  }

  console.log(`🌐 fetchList [${type}] → ${url}`);
  return fetchFromProxy(url, type, cacheKey);
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

// ─────────────────────────────────────────────────────────────────────────────
// Anime Data / Info
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchAnimeData(
  animeId: string,
  provider: string = 'kickassanime',
) {
  const attemptFetch = async (prov: string) => {
    const params = new URLSearchParams({ provider: prov });
    const url = `${BASE_URL}meta/anilist/data/${animeId}?${params.toString()}`;
    const cacheKey = generateCacheKey('animeData', animeId, prov);
    return await fetchFromProxy(url, 'Data', cacheKey);
  };

  let finalProvider = provider || 'kickassanime';

  // ─── Step 1: initial fetch to detect content type ────────────────────────
  // Always query AniList directly for genres/isAdult to avoid providers stripping adult tags.
  let firstData: any = null;
  try {
    firstData = await fetchAniListMediaBase(animeId);
  } catch (error) {
    console.log(`⚠️ Error fetching base AniList data...`, error);
  }

  const isEmpty = (d: any) =>
    !d || (typeof d === 'object' && Object.keys(d).length === 0);

  // Detect hentai ONCE from the initial probe — this flag is never overwritten.
  const detectedHentai: boolean =
    (!isEmpty(firstData) && firstData.isAdult === true) ||
    (!isEmpty(firstData) && Array.isArray(firstData?.genres) &&
     firstData.genres.some((g: string) => g.toLowerCase() === 'hentai'));

  // If we just fetched base metadata, we still need to fetch actual data from a provider
  // if it's not hentai (hentai might just bypass provider data entirely or try hentaimama).
  // Let's perform a probe fetch if needed.
  let providerData: any = null;
  
  // Helper to merge AniList base data into provider data
  const mergeBaseData = (data: any) => {
    if (isEmpty(data)) return firstData ?? {};
    return {
      ...data,
      genres: firstData?.genres || data?.genres,
      isAdult: firstData?.isAdult !== undefined ? firstData.isAdult : data?.isAdult,
    };
  };

  // ─── Step 2: route to the right provider chain ────────────────────────────
  if (detectedHentai) {
    // Hentai path: hentaimama → watchhentai. Never fall through to regular providers.
    console.log(`🔞 Hentai detected — using hentaimama as primary provider.`);

    // If the initial fetch was already from a hentai provider, return it directly.
    if (!isEmpty(providerData) && (finalProvider === 'hentaimama' || finalProvider === 'watchhentai')) {
      return mergeBaseData(providerData);
    }

    const hentaiProviders = ['hentaimama', 'watchhentai'];
    for (const prov of hentaiProviders) {
      if (prov === finalProvider) continue; // already tried
      try {
        console.log(`⚠️ Trying hentai provider: ${prov}...`);
        const data = await attemptFetch(prov);
        if (!isEmpty(data)) return mergeBaseData(data);
      } catch (error) {
        console.log(`⚠️ Error from ${prov}...`, error);
      }
    }

    // Both hentai providers failed — return whatever the initial fetch gave us
    // (even if empty) so callers can handle it gracefully.
    return mergeBaseData(providerData);
  }

  // ─── Step 3: non-hentai path ─────────────────────────────────────────────
  try {
    providerData = await attemptFetch(finalProvider);
  } catch (error) {
    console.log(`⚠️ Error from ${finalProvider}...`, error);
  }

  // If the initial fetch returned valid non-hentai data, return it now.
  if (!isEmpty(providerData)) return mergeBaseData(providerData);

  // Otherwise try the standard fallback chain.
  const canTryAnimePahe = finalProvider !== 'animepahe';
  const canTryReanime   = finalProvider !== 'reanime';

  if (canTryAnimePahe) {
    try {
      console.log(`⚠️ No data from ${finalProvider}, trying animepahe...`);
      const paheData = await attemptFetch('animepahe');
      if (!isEmpty(paheData)) return mergeBaseData(paheData);
    } catch (error) {
      console.log(`⚠️ Error from animepahe...`, error);
    }
  }

  if (canTryReanime) {
    try {
      console.log(`⚠️ No data from animepahe, trying reanime...`);
      const reanimeData = await attemptFetch('reanime');
      if (!isEmpty(reanimeData)) return mergeBaseData(reanimeData);
    } catch (error) {
      console.log(`⚠️ Error from reanime...`, error);
    }
  }

  return mergeBaseData({});
}

export async function fetchAnimeInfo(
  animeId: string,
  provider: string = 'kickassanime',
) {
  const attemptFetch = async (prov: string) => {
    const params = new URLSearchParams({ provider: prov });
    const url = `${BASE_URL}meta/anilist/info/${animeId}?${params.toString()}`;
    const cacheKey = generateCacheKey('animeInfo', animeId, prov);
    return await fetchFromProxy(url, 'Info', cacheKey);
  };

  let finalProvider = provider || 'kickassanime';
  let isHentai = false;

  const handleData = async (data: any, currentProv: string) => {
    if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
      return null;
    }
    isHentai = data?.genres?.some((g: string) => g.toLowerCase() === 'hentai');
    if (isHentai && currentProv !== 'watchhentai' && currentProv !== 'hentaimama') {
      console.log(`⚠️ Anime is Hentai, switching provider to watchhentai...`);
      return await attemptFetch('watchhentai');
    }
    if (!isHentai && (currentProv === 'watchhentai' || currentProv === 'hentaimama')) {
      console.log(`⚠️ Anime is NOT Hentai, switching provider to kickassanime...`);
      return await attemptFetch('kickassanime');
    }
    return data;
  };

  let lastError: any;

  try {
    let info = await attemptFetch(finalProvider);
    info = await handleData(info, finalProvider);
    if (info) return info;
  } catch (error) {
    console.log(`⚠️ Error from ${finalProvider}...`, error);
    lastError = error;
  }

  if (isHentai) {
    const canTryHentaimama = finalProvider !== 'hentaimama';
    if (canTryHentaimama) {
      try {
        console.log(`⚠️ No info from watchhentai, trying hentaimama...`);
        let hInfo = await attemptFetch('hentaimama');
        hInfo = await handleData(hInfo, 'hentaimama');
        if (hInfo) return hInfo;
      } catch (error) {
        console.log(`⚠️ Error from hentaimama...`, error);
        lastError = error;
      }
    }
    if (lastError) throw lastError;
    return {};
  }

  const canTryAnimePahe = finalProvider !== 'animepahe' && finalProvider !== 'hentaimama';
  const canTryReanime = finalProvider !== 'reanime' && finalProvider !== 'hentaimama';

  if (canTryAnimePahe) {
    try {
      console.log(`⚠️ No info from ${finalProvider}, trying animepahe...`);
      let paheInfo = await attemptFetch('animepahe');
      paheInfo = await handleData(paheInfo, 'animepahe');
      if (paheInfo) return paheInfo;
    } catch (error) {
      console.log(`⚠️ Error from animepahe...`, error);
      lastError = error;
    }
  }

  if (canTryReanime) {
    try {
      console.log(`⚠️ No info from animepahe, trying reanime...`);
      let reanimeInfo = await attemptFetch('reanime');
      reanimeInfo = await handleData(reanimeInfo, 'reanime');
      if (reanimeInfo) return reanimeInfo;
    } catch (error) {
      console.log(`⚠️ Error from reanime...`, error);
      lastError = error;
    }
  }

  if (lastError) throw lastError;
  return {};
}

/**
 * Fetches manga info for a SPECIFIC provider without any internal fallback.
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

// ─────────────────────────────────────────────────────────────────────────────
// Episodes
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchAnimeEpisodes(
  animeId: string,
  provider: string = 'kickassanime',
  dub: boolean = false,
) {
  const finalProvider = provider || 'kickassanime';
  const isHentaiProvider = finalProvider === 'hentaimama' || finalProvider === 'watchhentai';
  const canTryAnimePahe = !isHentaiProvider && finalProvider !== 'animepahe';
  const canTryReanime = !isHentaiProvider && finalProvider !== 'reanime';
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

    if (!episodes ||
      (Array.isArray(episodes) && episodes.length === 0) ||
      (typeof episodes === 'object' && Object.keys(episodes).length === 0)) {
      if (canTryAnimePahe) {
        console.log(`⚠️ No episodes from ${finalProvider}, trying animepahe...`);
        const paheParams = new URLSearchParams({
          provider: 'animepahe',
          dub: dub ? 'true' : 'false',
        });
        const paheUrl = `${BASE_URL}meta/anilist/episodes/${animeId}?${paheParams.toString()}`;
        const paheCacheKey = generateCacheKey(
          'animeEpisodes',
          animeId,
          'animepahe',
          dub ? 'dub' : 'sub',
        );
        const paheEpisodes = attachProvider(
          await fetchFromProxy(paheUrl, 'Episodes', paheCacheKey),
          'animepahe',
        );
        if (paheEpisodes && !(Array.isArray(paheEpisodes) && paheEpisodes.length === 0) && !(typeof paheEpisodes === 'object' && Object.keys(paheEpisodes).length === 0)) {
          return paheEpisodes;
        }
      }
      if (canTryReanime) {
        console.log(`⚠️ No episodes from ${finalProvider}, trying reanime...`);
        const reanimeParams = new URLSearchParams({
          provider: 'reanime',
          dub: dub ? 'true' : 'false',
        });
        const reanimeUrl = `${BASE_URL}meta/anilist/episodes/${animeId}?${reanimeParams.toString()}`;
        const reanimeCacheKey = generateCacheKey(
          'animeEpisodes',
          animeId,
          'reanime',
          dub ? 'dub' : 'sub',
        );
        const reanimeEpisodes = attachProvider(
          await fetchFromProxy(reanimeUrl, 'Episodes', reanimeCacheKey),
          'reanime',
        );
        if (reanimeEpisodes && !(Array.isArray(reanimeEpisodes) && reanimeEpisodes.length === 0) && !(typeof reanimeEpisodes === 'object' && Object.keys(reanimeEpisodes).length === 0)) {
          return reanimeEpisodes;
        }
      }
    }

    return episodes;
  } catch (error) {
    if (canTryAnimePahe) {
      console.log(`⚠️ Error from ${finalProvider}, trying animepahe...`, error);
      const paheParams = new URLSearchParams({
        provider: 'animepahe',
        dub: dub ? 'true' : 'false',
      });
      const paheUrl = `${BASE_URL}meta/anilist/episodes/${animeId}?${paheParams.toString()}`;
      const paheCacheKey = generateCacheKey(
        'animeEpisodes',
        animeId,
        'animepahe',
        dub ? 'dub' : 'sub',
      );
      try {
        return attachProvider(
          await fetchFromProxy(paheUrl, 'Episodes', paheCacheKey),
          'animepahe',
        );
      } catch (paheError) {
        if (canTryReanime) {
          console.log(`⚠️ Error from animepahe, trying reanime...`, paheError);
          const reanimeParams = new URLSearchParams({
            provider: 'reanime',
            dub: dub ? 'true' : 'false',
          });
          const reanimeUrl = `${BASE_URL}meta/anilist/episodes/${animeId}?${reanimeParams.toString()}`;
          const reanimeCacheKey = generateCacheKey(
            'animeEpisodes',
            animeId,
            'reanime',
            dub ? 'dub' : 'sub',
          );
          try {
            return attachProvider(
              await fetchFromProxy(reanimeUrl, 'Episodes', reanimeCacheKey),
              'reanime',
            );
          } catch (reanimeError) {
            throw reanimeError;
          }
        }
        throw paheError;
      }
    }
    if (canTryReanime) {
      console.log(`⚠️ Error from ${finalProvider}, trying reanime...`, error);
      const reanimeParams = new URLSearchParams({
        provider: 'reanime',
        dub: dub ? 'true' : 'false',
      });
      const reanimeUrl = `${BASE_URL}meta/anilist/episodes/${animeId}?${reanimeParams.toString()}`;
      const reanimeCacheKey = generateCacheKey(
        'animeEpisodes',
        animeId,
        'reanime',
        dub ? 'dub' : 'sub',
      );
      try {
        return attachProvider(
          await fetchFromProxy(reanimeUrl, 'Episodes', reanimeCacheKey),
          'reanime',
        );
      } catch (reanimeError) {
        throw reanimeError;
      }
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
  requestTimeout?: number,
) {
  const finalProvider = provider || 'kickassanime';
  const isHentaiProvider = finalProvider === 'hentaimama' || finalProvider === 'watchhentai';
  const canTryAnimePahe = !isHentaiProvider && finalProvider !== 'animepahe';
  const canTryReanime = !isHentaiProvider && finalProvider !== 'reanime';
  const params = new URLSearchParams({ episodeId, provider: finalProvider });
  const url = `${BASE_URL}meta/anilist/watch?${params.toString()}`;
  const cacheKey = generateCacheKey(
    'animeStreamingLinks',
    episodeId,
    finalProvider,
    server || '',
  );
  const timeoutToUse = requestTimeout ?? (finalProvider === 'anikoto' ? 30000 : undefined);

  try {
    const links = await fetchFromProxy(url, 'Video Sources', cacheKey, timeoutToUse);

    if (!links || (typeof links === 'object' && Object.keys(links).length === 0)) {
      if (canTryAnimePahe) {
        console.log(`⚠️ No streaming links from ${finalProvider}, trying animepahe...`);
        const paheParams = new URLSearchParams({ episodeId, provider: 'animepahe' });
        const paheUrl = `${BASE_URL}meta/anilist/watch?${paheParams.toString()}`;
        const paheCacheKey = generateCacheKey('animeStreamingLinks', episodeId, 'animepahe', server || '');
        const paheLinks = await fetchFromProxy(paheUrl, 'Video Sources', paheCacheKey, timeoutToUse);
        if (paheLinks && !(typeof paheLinks === 'object' && Object.keys(paheLinks).length === 0)) {
          return paheLinks;
        }
      }
      if (canTryReanime) {
        console.log(`⚠️ No streaming links from ${finalProvider}, trying reanime...`);
        const reanimeParams = new URLSearchParams({ episodeId, provider: 'reanime' });
        const reanimeUrl = `${BASE_URL}meta/anilist/watch?${reanimeParams.toString()}`;
        const reanimeCacheKey = generateCacheKey('animeStreamingLinks', episodeId, 'reanime', server || '');
        const reanimeLinks = await fetchFromProxy(reanimeUrl, 'Video Sources', reanimeCacheKey, timeoutToUse);
        if (reanimeLinks && !(typeof reanimeLinks === 'object' && Object.keys(reanimeLinks).length === 0)) {
          return reanimeLinks;
        }
      }
    }

    return links;
  } catch (error) {
    if (canTryAnimePahe) {
      console.log(`⚠️ Error from ${finalProvider}, trying animepahe...`, error);
      const paheParams = new URLSearchParams({ episodeId, provider: 'animepahe' });
      const paheUrl = `${BASE_URL}meta/anilist/watch?${paheParams.toString()}`;
      const paheCacheKey = generateCacheKey('animeStreamingLinks', episodeId, 'animepahe', server || '');
      try {
        return await fetchFromProxy(paheUrl, 'Video Sources', paheCacheKey, timeoutToUse);
      } catch (paheError) {
        if (canTryReanime) {
          console.log(`⚠️ Error from animepahe, trying reanime...`, paheError);
          const reanimeParams = new URLSearchParams({ episodeId, provider: 'reanime' });
          const reanimeUrl = `${BASE_URL}meta/anilist/watch?${reanimeParams.toString()}`;
          const reanimeCacheKey = generateCacheKey('animeStreamingLinks', episodeId, 'reanime', server || '');
          try {
            return await fetchFromProxy(reanimeUrl, 'Video Sources', reanimeCacheKey, timeoutToUse);
          } catch (reanimeError) {
            throw reanimeError;
          }
        }
        throw paheError;
      }
    }
    if (canTryReanime) {
      console.log(`⚠️ Error from ${finalProvider}, trying reanime...`, error);
      const reanimeParams = new URLSearchParams({ episodeId, provider: 'reanime' });
      const reanimeUrl = `${BASE_URL}meta/anilist/watch?${reanimeParams.toString()}`;
      const reanimeCacheKey = generateCacheKey('animeStreamingLinks', episodeId, 'reanime', server || '');
      try {
        return await fetchFromProxy(reanimeUrl, 'Video Sources', reanimeCacheKey, timeoutToUse);
      } catch (reanimeError) {
        throw reanimeError;
      }
    }
    throw error;
  }
}

export async function fetchAnimeStreamingLinksProxied(
  episodeId: string,
  provider: string = 'kickassanime',
  server?: string,
  referer?: string,
) {
  const finalProvider = provider || 'kickassanime';
  const requestTimeout = finalProvider === 'anikoto' ? 30000 : undefined;
  const data = await fetchAnimeStreamingLinks(episodeId, finalProvider, server, requestTimeout);

  const proxyUrl = finalProvider === 'reanime'
    ? M3U8_PROXY_URL_2 || M3U8_PROXY_URL
    : M3U8_PROXY_URL;

  if (finalProvider === 'watchhentai') {
    return data;
  }

  if (!proxyUrl) {
    console.warn('⚠️ M3U8 proxy skipped: missing proxy configuration.');
    return data;
  }

  if (finalProvider === 'reanime' && !M3U8_PROXY_URL_2) {
    console.warn(
      `⚠️ ${finalProvider} is using the fallback M3U8 proxy because VITE_M3U8_PROXY_URL_2 is not set.`,
    );
  }

  const REANIME_REFERER = 'https://reanime.to';

  let serverUrl = finalProvider === 'reanime' ? REANIME_REFERER : referer;
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

// ─────────────────────────────────────────────────────────────────────────────
// Skip Times / Recent Episodes / Studio
// ─────────────────────────────────────────────────────────────────────────────

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
  provider: string = 'anikoto',
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
    return await fetchRecentEpisodes(page, perPage, 'anikoto');
  } catch (error) {
    console.warn('anikoto failed for recent episodes, trying kickassanime');
    try {
      return await fetchRecentEpisodes(page, perPage, 'kickassanime');
    } catch (fallbackError) {
      console.warn('kickassanime failed for recent episodes, trying animepahe');
      try {
        return await fetchRecentEpisodes(page, perPage, 'animepahe');
      } catch (finalError) {
        console.error('All recent episodes providers failed:', finalError);
        return [];
      }
    }
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

// ─────────────────────────────────────────────────────────────────────────────
// Multi-Provider Episode & Server Fetching
// ─────────────────────────────────────────────────────────────────────────────

export interface MergedEpisode {
  number: string;
  title: string;
  image: string;
  description: string;
  imageHash: string;
  airDate: string;
  providers: Record<
    string,
    {
      id: string;
      provider: string;
      title: string;
      image: string;
      description: string;
      imageHash: string;
      airDate: string;
    }
  >;
}

function extractEpisodeNumber(episodeId: string, index: number): string {
  if (!episodeId) return String(index + 1);

  if (episodeId.includes('/episode/')) {
    const episodePart = episodeId.split('/episode/')[1];
    const episodeNumberMatch = episodePart.match(/^ep-(\d+)/);
    if (episodeNumberMatch) return episodeNumberMatch[1];
  } else if (episodeId.includes('-episode-')) {
    const episodePart = episodeId.split('-episode-')[1];
    const episodeNumberMatch = episodePart.match(/^ep-(\d+)/);
    if (episodeNumberMatch) return episodeNumberMatch[1];
  }

  return String(index + 1);
}

export async function fetchEpisodesFromMultipleProviders(
  animeId: string,
  dub: boolean = false,
  providers: string[] = ['kickassanime', 'animepahe', 'anikoto', 'reanime'],
): Promise<MergedEpisode[]> {
  console.log(`🌐 Fetching episodes from multiple providers: ${providers.join(', ')}`);

  const providerResults = await Promise.allSettled(
    providers.map((provider) =>
      fetchAnimeEpisodes(animeId, provider, dub).then((episodes) => ({
        provider,
        episodes: Array.isArray(episodes) ? episodes : [],
      })),
    ),
  );

  const episodeMap = new Map<string, MergedEpisode>();

  providerResults.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      const { provider, episodes } = result.value;
      console.log(`✅ Fetched ${episodes.length} episodes from ${provider}`);

      episodes.forEach((ep: any, epIndex: number) => {
        if (!ep || !ep.id) return;

        const episodeNumber = extractEpisodeNumber(ep.id, epIndex);
        const episodeKey = episodeNumber;

        if (!episodeMap.has(episodeKey)) {
          episodeMap.set(episodeKey, {
            number: episodeNumber,
            title: ep.title || `Episode ${episodeNumber}`,
            image: ep.image || '',
            description: ep.description || '',
            imageHash: ep.imageHash || '',
            airDate: ep.airDate || '',
            providers: {},
          });
        }

        const actualProvider = ep.provider || provider;

        const merged = episodeMap.get(episodeKey)!;
        merged.providers[actualProvider] = {
          id: ep.id,
          provider: actualProvider,
          title: ep.title || `Episode ${episodeNumber}`,
          image: ep.image || '',
          description: ep.description || '',
          imageHash: ep.imageHash || '',
          airDate: ep.airDate || '',
        };

        if (!merged.image && ep.image) {
          merged.image = ep.image;
        }
        if (!merged.description && ep.description) {
          merged.description = ep.description;
        }
      });
    } else {
      const provider = providers[index];
      console.warn(`⚠️ Failed to fetch episodes from ${provider}:`, result.reason);
    }
  });

  const mergedEpisodes = Array.from(episodeMap.values())
    .sort((a, b) => parseInt(a.number) - parseInt(b.number));

  console.log(
    `✅ Merged episodes: ${mergedEpisodes.length} total, providers per episode: ${mergedEpisodes
      .map((e) => Object.keys(e.providers).length)
      .reduce((a, b) => a + b, 0) /
    Math.max(mergedEpisodes.length, 1)
    } avg`,
  );

  return mergedEpisodes;
}

export async function fetchServersFromMultipleProviders(
  episodesByProvider: Record<string, string>,
  providers: string[] = ['kickassanime', 'animepahe', 'anikoto', 'reanime'],
): Promise<
  Array<{
    provider: string;
    servers: any[];
    response: any;
  }>
> {
  console.log(
    `🌐 Fetching servers from multiple providers for episode IDs: ${JSON.stringify(
      episodesByProvider,
    )}`,
  );

  const serverResults = await Promise.allSettled(
    providers.map((provider) => {
      const episodeId = episodesByProvider[provider];
      if (!episodeId) {
        return Promise.reject(
          new Error(`No episode ID for provider ${provider}`),
        );
      }

      return fetchAnimeStreamingLinksProxied(episodeId, provider).then(
        (response) => {
          const rawServers = response?.servers || [];
          const hasDirectSources =
            Array.isArray(response?.sources) && response.sources.length > 0;

          const servers =
            provider === 'hentaimama' && hasDirectSources
              ? []
              : rawServers.map((s: any) => ({
                name: s.name,
                url: s.url,
                type: s.type,
              }));

          console.log(`✅ Fetched ${servers.length} servers from ${provider}`);

          return {
            provider,
            servers,
            response,
          };
        },
      );
    }),
  );

  const results: Array<{
    provider: string;
    servers: any[];
    response: any;
  }> = [];

  serverResults.forEach((result) => {
    if (result.status === 'fulfilled') {
      results.push(result.value);
    } else {
      console.warn(`⚠️ Failed to fetch servers:`, result.reason);
    }
  });

  console.log(
    `✅ Aggregated servers from ${results.length} providers:`,
    results.map((r) => `${r.provider}(${r.servers.length})`).join(', '),
  );

  return results;
}