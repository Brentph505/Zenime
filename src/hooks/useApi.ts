import axios from 'axios';
import { cacheManager } from '../lib/caching';
import {
  DEFAULT_ANIME_PROVIDERS,
  HENTAI_ANIME_PROVIDERS as hentaiAnimeProviders,
  isHentaiAnimeProvider as isHentaiProvider,
  proxyAnimeStreamingResponse,
} from '../lib/animePlayback';
import { normalizeMangaProvider as normalizeMangaProviderForApi } from '../lib/mangaProviders';

export {
  ANIME_PROVIDER_PRIORITY,
  ANIME_PROVIDERS,
  DEFAULT_ANIME_PROVIDERS,
  WATCH_ANIME_PROVIDERS,
  HLS_FIRST_PROVIDERS,
  buildEmbeddedPlayerUrl,
  buildKaaSubtitleProxyUrl,
  buildM3U8ProxyUrl,
  buildXanimeSubtitleProxyUrl,
  createAnimeServerLabeler,
  getDirectMediaType,
  isDirectMediaUrl,
  isEmbeddedPlaybackServer,
  proxyHentaiMp4Url,
  proxyAnimeMediaUrl,
  proxyHstreamSubtitles,
  proxyKaaSubtitles,
  proxyM3U8Sources,
  proxyXanimeSubtitles,
  resolveProviderReferer,
} from '../lib/animePlayback';
export {
  buildHentaiImageProxyUrl,
  buildImageProxyUrl,
  buildMangaImageProxyUrl,
  getMangaProviderFallbackOrder,
  HENTAI_MANGA_PROVIDERS,
  isHentaiMangaProvider,
  isMangaCatalogProvider,
  MANGA_CATALOG_PROVIDERS,
  MANGA_PROVIDERS,
  normalizeMangaProvider,
} from '../lib/mangaProviders';
export type { HentaiMangaProvider, MangaCatalogProvider, MangaProvider } from '../lib/mangaProviders';
export {
  hentaiAnimeProviders as HENTAI_ANIME_PROVIDERS,
  isHentaiProvider as isHentaiAnimeProvider,
  proxyAnimeStreamingResponse,
};

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

function getPreviousSeasonInfo(
  season: AniListSeason,
  year: number,
): { season: AniListSeason; year: number } {
  switch (season) {
    case 'WINTER':
      return { season: 'FALL', year: year - 1 };
    case 'SPRING':
      return { season: 'WINTER', year };
    case 'SUMMER':
      return { season: 'SPRING', year };
    case 'FALL':
    default:
      return { season: 'SUMMER', year };
  }
}

export function getSeasonFallbackCandidates(
  season: AniListSeason,
  year: number,
  limit: number = 2,
): Array<{ season: AniListSeason; year: number }> {
  const candidates: Array<{ season: AniListSeason; year: number }> = [];
  let currentSeason = season;
  let currentYear = year;

  for (let index = 0; index < limit; index++) {
    candidates.push({ season: currentSeason, year: currentYear });
    const previous = getPreviousSeasonInfo(currentSeason, currentYear);
    currentSeason = previous.season;
    currentYear = previous.year;
  }

  return candidates;
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

function normalizeEpisodeResponse(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.episodes)) return payload.episodes;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.episodes)) return payload.data.episodes;
  return [];
}
function normalizeStreamingResponse(payload: any): any {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload;
  if (payload.sources || payload.servers || payload.subtitles) return payload;
  if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
    return payload.data;
  }
  return payload;
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
      description(asHtml: true)
    }
  }
`;

export async function fetchAniListMediaBase(animeId: string): Promise<any> {
  const cacheKey = generateCacheKey('aniListMediaBase-v2', animeId);

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

export interface AniListNextAiringEpisode {
  airingAt: number;
  episode: number;
  timeUntilAiring: number;
}

const NEXT_AIRING_EPISODE_QUERY = `
  query ($id: Int!) {
    Media(id: $id, type: ANIME) {
      nextAiringEpisode {
        airingAt
        episode
        timeUntilAiring
      }
    }
  }
`;

export async function fetchNextAiringEpisode(
  animeId: string,
): Promise<AniListNextAiringEpisode | null> {
  const id = Number.parseInt(animeId, 10);
  if (!Number.isFinite(id)) return null;

  try {
    const response = await fetch(ANILIST_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        query: NEXT_AIRING_EPISODE_QUERY,
        variables: { id },
      }),
    });

    if (!response.ok) {
      throw new Error(`AniList GraphQL error: HTTP ${response.status}`);
    }

    const json = await response.json();
    if (json.errors) {
      throw new Error(json.errors[0]?.message ?? 'AniList GraphQL error');
    }

    return json?.data?.Media?.nextAiringEpisode ?? null;
  } catch (error) {
    console.warn(`⚠️ Failed to fetch next airing episode for ${animeId}:`, error);
    return null;
  }
}

async function fetchFromProxy(
  url: string,
  cacheKeyName: string,
  cacheKey: string,
  requestTimeout?: number,
  cacheValueTransform?: (data: any) => any,
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

        return cacheValueTransform
          ? cacheValueTransform(response.data)
          : response.data;
      },
    );

    return cacheValueTransform ? cacheValueTransform(data) : data;
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
    let rateLimitRetries = 0;
    let response: Response | null = null;

    // Retry the same page a bounded number of times when AniList rate-limits
    // us (HTTP 429). Without this cap, the old code `continue`d without
    // incrementing `page`, looping forever if the rate limit persisted.
    while (rateLimitRetries <= 3) {
      response = await fetch(ANILIST_GRAPHQL_URL, {
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

      if (response.status !== 429) break;

      rateLimitRetries++;
      console.warn(
        `⚠️ AniList rate limit hit on page ${page} (attempt ${rateLimitRetries}/3), waiting 2 s…`,
      );
      await new Promise((r) => setTimeout(r, 2000));
    }

    try {
      if (!response) break;

      if (response.status === 429) {
        // Exhausted rate-limit retries for this page — stop paginating.
        console.warn(`⚠️ AniList rate limit persisted after retries; stopping at page ${page}.`);
        break;
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
      const { season, year: currentYear } = getCurrentSeasonInfo();
      console.log(`🧠 TopAiring → season: ${season}, year: ${currentYear}`);

      const candidates = getSeasonFallbackCandidates(season, currentYear, 2);

      for (const candidate of candidates) {
        const params = new URLSearchParams({
          type: 'ANIME',
          status: 'RELEASING',
          sort: '["POPULARITY_DESC"]',
          season: candidate.season,
          year: candidate.year.toString(),
          page: page.toString(),
          perPage: perPage.toString(),
        });

        const candidateUrl = `${BASE_URL}meta/anilist/advanced-search?${params.toString()}`;
        const candidateCacheKey = generateCacheKey(
          'TopAiringAnime',
          page.toString(),
          perPage.toString(),
          candidate.season,
          candidate.year.toString(),
        );

        const result = await fetchFromProxy(
          candidateUrl,
          'TopAiring',
          candidateCacheKey,
        );

        if (Array.isArray(result?.results) && result.results.length > 0) {
          if (
            candidate.season !== season ||
            candidate.year !== currentYear
          ) {
            console.log(
              `🧠 TopAiring fallback used season: ${candidate.season}, year: ${candidate.year}`,
            );
          }
          return result;
        }

        console.log(
          `🧠 TopAiring empty for ${candidate.season} ${candidate.year}; trying previous season.`,
        );
      }

      return { results: [], hasNextPage: false };
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
  provider: string = 'anikoto',
) {
  const stripNextAiringEpisode = (data: any) => {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return data;
    const cacheSafeData = { ...data };
    delete cacheSafeData.nextAiringEpisode;
    return cacheSafeData;
  };

  const attemptFetch = async (prov: string) => {
    const params = new URLSearchParams({ provider: prov });
    const url = `${BASE_URL}meta/anilist/data/${animeId}?${params.toString()}`;
    const cacheKey = generateCacheKey('animeData-v3', animeId, prov);
    return await fetchFromProxy(url, 'Data', cacheKey, undefined, stripNextAiringEpisode);
  };

  await cacheManager.invalidatePattern('Data', generateCacheKey('animeData-v2', animeId));

  let finalProvider = provider || 'anikoto';

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
      description: data?.description || firstData?.description || '',
    };
  };

  // ─── Step 2: route to the right provider chain ────────────────────────────
  if (detectedHentai) {
    // Hentai providers stay isolated from the regular anime fallback chain.
    if (isHentaiProvider(finalProvider)) {
      try {
        providerData = await attemptFetch(finalProvider);
        if (!isEmpty(providerData)) return mergeBaseData(providerData);
      } catch (error) {
        console.log(`⚠️ Error from ${finalProvider}...`, error);
      }
    }

    for (const prov of hentaiAnimeProviders) {
      if (prov === finalProvider) continue; // already tried
      try {
        console.log(`⚠️ Trying hentai provider: ${prov}...`);
        const data = await attemptFetch(prov);
        if (!isEmpty(data)) return mergeBaseData(data);
      } catch (error) {
        console.log(`⚠️ Error from ${prov}...`, error);
      }
    }

    // All hentai providers failed — return whatever data is available
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
  const canTryKickassanime = finalProvider !== 'kickassanime';
  const canTryAnimePahe = finalProvider !== 'animepahe';
  const canTryReanime   = finalProvider !== 'reanime';

  if (canTryReanime) {
    try {
      console.log(`⚠️ No data from ${finalProvider}, trying reanime...`);
      const reanimeData = await attemptFetch('reanime');
      if (!isEmpty(reanimeData)) return mergeBaseData(reanimeData);
    } catch (error) {
      console.log(`⚠️ Error from reanime...`, error);
    }
  }

  if (canTryKickassanime) {
    try {
      console.log(`⚠️ No data from ${finalProvider}, trying kickassanime...`);
      const kickassData = await attemptFetch('kickassanime');
      if (!isEmpty(kickassData)) return mergeBaseData(kickassData);
    } catch (error) {
      console.log(`⚠️ Error from kickassanime...`, error);
    }
  }

  if (canTryAnimePahe) {
    try {
      console.log(`⚠️ No data from ${finalProvider}, trying animepahe...`);
      const paheData = await attemptFetch('animepahe');
      if (!isEmpty(paheData)) return mergeBaseData(paheData);
    } catch (error) {
      console.log(`⚠️ Error from animepahe...`, error);
    }
  }

  return mergeBaseData({});
}

function isHentaiGenres(genres?: string[]): boolean {
  return Array.isArray(genres) && genres.some((genre) => genre.toLowerCase() === 'hentai');
}

export async function fetchAnimeInfo(
  animeId: string,
  provider: string = 'anikoto',
) {
  const attemptFetch = async (prov: string) => {
    const params = new URLSearchParams({ provider: prov });
    const url = `${BASE_URL}meta/anilist/info/${animeId}?${params.toString()}`;
    const cacheKey = generateCacheKey('animeInfo-v2', animeId, prov);
    return await fetchFromProxy(url, 'Info', cacheKey);
  };

  let finalProvider = provider || 'anikoto';
  let isHentai = false;
  let aniListBase: any = null;

  try {
    aniListBase = await fetchAniListMediaBase(animeId);
    isHentai = isHentaiGenres(aniListBase?.genres);
  } catch (error) {
    console.log(`⚠️ Error fetching AniList fallback metadata...`, error);
  }

  const mergeInfoDescription = (data: any) => {
    if (!data || typeof data !== 'object') return data;

    return {
      ...data,
      description: data.description || aniListBase?.description || '',
    };
  };

  const handleData = async (data: any, currentProv: string) => {
    if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
      return null;
    }
    const enrichedData = mergeInfoDescription(data);
    isHentai = enrichedData?.genres?.some((g: string) => g.toLowerCase() === 'hentai');
    if (isHentai && !isHentaiProvider(currentProv)) {
      console.log(`⚠️ Anime is Hentai, switching provider to watchhentai...`);
      return mergeInfoDescription(await attemptFetch(hentaiAnimeProviders[0]));
    }
    if (!isHentai && isHentaiProvider(currentProv)) {
      console.log(`⚠️ Anime is NOT Hentai, switching provider to kickassanime...`);
      return mergeInfoDescription(await attemptFetch('kickassanime'));
    }
    return enrichedData;
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
    for (const hentaiProvider of hentaiAnimeProviders) {
      if (hentaiProvider === finalProvider) continue;
      try {
        console.log(`⚠️ No info from ${finalProvider}, trying ${hentaiProvider}...`);
        const hInfo = await handleData(
          await attemptFetch(hentaiProvider),
          hentaiProvider,
        );
        if (hInfo) return hInfo;
      } catch (error) {
        console.log(`⚠️ Error from ${hentaiProvider}...`, error);
        lastError = error;
      }
    }
    if (lastError) throw lastError;
    return {};
  }

  const canTryKickassanime = finalProvider !== 'kickassanime' && !isHentaiProvider(finalProvider);
  const canTryAnimePahe = finalProvider !== 'animepahe' && !isHentaiProvider(finalProvider);
  const canTryReanime = finalProvider !== 'reanime' && !isHentaiProvider(finalProvider);

  if (canTryReanime) {
    try {
      console.log(`⚠️ No info from ${finalProvider}, trying reanime...`);
      let reanimeInfo = await attemptFetch('reanime');
      reanimeInfo = await handleData(reanimeInfo, 'reanime');
      if (reanimeInfo) return reanimeInfo;
    } catch (error) {
      console.log(`⚠️ Error from reanime...`, error);
      lastError = error;
    }
  }

  if (canTryKickassanime) {
    try {
      console.log(`⚠️ No info from ${finalProvider}, trying kickassanime...`);
      let kickassInfo = await attemptFetch('kickassanime');
      kickassInfo = await handleData(kickassInfo, 'kickassanime');
      if (kickassInfo) return kickassInfo;
    } catch (error) {
      console.log(`⚠️ Error from kickassanime...`, error);
      lastError = error;
    }
  }

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

  if (lastError) throw lastError;
  return {};
}

/**
 * Fetches manga info for a SPECIFIC provider without any internal fallback.
 */
export async function fetchMangaInfo(
  mangaId: string,
  provider: 'atsumaru' | 'mangahere' | 'mangapill' | 'mangakatana' | 'hentaireadio' | 'hentai20' = 'mangahere',
): Promise<any> {
  const finalProvider = normalizeMangaProviderForApi(provider || 'mangahere');
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
  provider: 'atsumaru' | 'mangahere' | 'mangapill' | 'mangakatana' | 'hentaireadio' | 'hentai20' = 'mangahere',
): Promise<MangaReadPage[]> {
  const finalProvider = normalizeMangaProviderForApi(provider || 'mangahere');
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
  provider: string = 'anikoto',
  dub: boolean = false,
) {
  const finalProvider = provider || 'anikoto';
  const isHentaiProviderForRequest = isHentaiProvider(finalProvider);
  const canTryKickassanime = !isHentaiProviderForRequest && finalProvider !== 'kickassanime';
  const canTryAnimePahe = !isHentaiProviderForRequest && finalProvider !== 'animepahe';
  const canTryReanime = !isHentaiProviderForRequest && finalProvider !== 'reanime';
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
      normalizeEpisodeResponse(await fetchFromProxy(url, 'Episodes', cacheKey)),
      finalProvider,
    );

    if (!episodes ||
      (Array.isArray(episodes) && episodes.length === 0) ||
      (typeof episodes === 'object' && Object.keys(episodes).length === 0)) {
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
      if (canTryKickassanime) {
        console.log(`⚠️ No episodes from ${finalProvider}, trying kickassanime...`);
        const kickassParams = new URLSearchParams({
          provider: 'kickassanime',
          dub: dub ? 'true' : 'false',
        });
        const kickassUrl = `${BASE_URL}meta/anilist/episodes/${animeId}?${kickassParams.toString()}`;
        const kickassCacheKey = generateCacheKey(
          'animeEpisodes',
          animeId,
          'kickassanime',
          dub ? 'dub' : 'sub',
        );
        const kickassEpisodes = attachProvider(
          await fetchFromProxy(kickassUrl, 'Episodes', kickassCacheKey),
          'kickassanime',
        );
        if (kickassEpisodes && !(Array.isArray(kickassEpisodes) && kickassEpisodes.length === 0) && !(typeof kickassEpisodes === 'object' && Object.keys(kickassEpisodes).length === 0)) {
          return kickassEpisodes;
        }
      }
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
    }

    return episodes;
  } catch (error) {
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
        if (canTryKickassanime) {
          console.log(`⚠️ Error from reanime, trying kickassanime...`, reanimeError);
          const kickassParams = new URLSearchParams({
            provider: 'kickassanime',
            dub: dub ? 'true' : 'false',
          });
          const kickassUrl = `${BASE_URL}meta/anilist/episodes/${animeId}?${kickassParams.toString()}`;
          const kickassCacheKey = generateCacheKey(
            'animeEpisodes',
            animeId,
            'kickassanime',
            dub ? 'dub' : 'sub',
          );
          try {
            return attachProvider(
              await fetchFromProxy(kickassUrl, 'Episodes', kickassCacheKey),
              'kickassanime',
            );
          } catch (kickassError) {
            if (canTryAnimePahe) {
              console.log(`⚠️ Error from kickassanime, trying animepahe...`, kickassError);
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
                throw paheError;
              }
            }
            throw kickassError;
          }
        }
        throw reanimeError;
      }
    }
    if (canTryKickassanime) {
      console.log(`⚠️ Error from ${finalProvider}, trying kickassanime...`, error);
      const kickassParams = new URLSearchParams({
        provider: 'kickassanime',
        dub: dub ? 'true' : 'false',
      });
      const kickassUrl = `${BASE_URL}meta/anilist/episodes/${animeId}?${kickassParams.toString()}`;
      const kickassCacheKey = generateCacheKey(
        'animeEpisodes',
        animeId,
        'kickassanime',
        dub ? 'dub' : 'sub',
      );
      try {
        return attachProvider(
          await fetchFromProxy(kickassUrl, 'Episodes', kickassCacheKey),
          'kickassanime',
        );
      } catch (kickassError) {
        if (canTryAnimePahe) {
          console.log(`⚠️ Error from kickassanime, trying animepahe...`, kickassError);
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
            throw paheError;
          }
        }
        throw kickassError;
      }
    }
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
        throw paheError;
      }
    }
    throw error;
  }
}

export async function fetchAnimeEmbeddedEpisodes(
  episodeId: string,
  provider: string = 'anikoto',
) {
  const finalProvider = provider || 'anikoto';
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
  const isHentaiProviderForRequest = isHentaiProvider(finalProvider);
  const canTryAnimePahe = !isHentaiProviderForRequest && finalProvider !== 'animepahe';
  const canTryReanime = !isHentaiProviderForRequest && finalProvider !== 'reanime';
  const params = new URLSearchParams({ episodeId, provider: finalProvider });
  const url = `${BASE_URL}meta/anilist/watch?${params.toString()}`;
  const cacheKey = generateCacheKey(
    'animeStreamingLinks',
    episodeId,
    finalProvider,
    server || '',
  );
  const timeoutToUse = requestTimeout ?? (
    isHentaiProviderForRequest
      ? 60000
      : 30000
  );

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

    return normalizeStreamingResponse(links);
  } catch (error) {
    if (canTryAnimePahe) {
      console.log(`⚠️ Error from ${finalProvider}, trying animepahe...`, error);
      const paheParams = new URLSearchParams({ episodeId, provider: 'animepahe' });
      const paheUrl = `${BASE_URL}meta/anilist/watch?${paheParams.toString()}`;
      const paheCacheKey = generateCacheKey('animeStreamingLinks', episodeId, 'animepahe', server || '');
      try {
        return normalizeStreamingResponse(
          await fetchFromProxy(paheUrl, 'Video Sources', paheCacheKey, timeoutToUse),
        );
      } catch (paheError) {
        if (canTryReanime) {
          console.log(`⚠️ Error from animepahe, trying reanime...`, paheError);
          const reanimeParams = new URLSearchParams({ episodeId, provider: 'reanime' });
          const reanimeUrl = `${BASE_URL}meta/anilist/watch?${reanimeParams.toString()}`;
          const reanimeCacheKey = generateCacheKey('animeStreamingLinks', episodeId, 'reanime', server || '');
          try {
            return normalizeStreamingResponse(
              await fetchFromProxy(reanimeUrl, 'Video Sources', reanimeCacheKey, timeoutToUse),
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
      const reanimeParams = new URLSearchParams({ episodeId, provider: 'reanime' });
      const reanimeUrl = `${BASE_URL}meta/anilist/watch?${reanimeParams.toString()}`;
      const reanimeCacheKey = generateCacheKey('animeStreamingLinks', episodeId, 'reanime', server || '');
      try {
        return normalizeStreamingResponse(
          await fetchFromProxy(reanimeUrl, 'Video Sources', reanimeCacheKey, timeoutToUse),
        );
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
  const requestTimeout =
    isHentaiProvider(finalProvider)
      ? 60000
      : 30000;
  const data = await fetchAnimeStreamingLinks(episodeId, finalProvider, server, requestTimeout);
  return proxyAnimeStreamingResponse(data, finalProvider, server, referer);
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
  isDub: boolean = false,
  providers: string[] = DEFAULT_ANIME_PROVIDERS,
): Promise<MergedEpisode[]> {
  console.log(`🌐 Fetching episodes from multiple providers: ${providers.join(', ')}`);

  const providerResults = await Promise.allSettled(
    providers.map((provider) =>
      fetchAnimeEpisodes(animeId, provider, isDub).then((episodes) => ({
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
        const episodeTitle = typeof ep.title === 'string' ? ep.title.trim() : '';

        if (!episodeMap.has(episodeKey)) {
          episodeMap.set(episodeKey, {
            number: episodeNumber,
            title: episodeTitle || `Episode ${episodeNumber}`,
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
          title: episodeTitle || `Episode ${episodeNumber}`,
          image: ep.image || '',
          description: ep.description || '',
          imageHash: ep.imageHash || '',
          airDate: ep.airDate || '',
        };

        if (!merged.image && ep.image) {
          merged.image = ep.image;
        }
        if ((!merged.title || merged.title === `Episode ${episodeNumber}`) && episodeTitle) {
          merged.title = episodeTitle;
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
  providers: string[] = DEFAULT_ANIME_PROVIDERS,
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