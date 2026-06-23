import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { FaBell } from 'react-icons/fa';
import styled from 'styled-components';
import Image404URL from '/src/assets/404.webp';

// ─── IndexedDB Helper for Large Storage ───────────────────────────────────────
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
      request.onerror = () => {
        console.warn('[WatchHistoryDB] Failed to open IndexedDB');
        reject(request.error);
      };
      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME, { keyPath: 'animeId' });
        }
      };
    });
  }

  async saveWatchedEpisodes(animeId: string, episodes: any[]): Promise<void> {
    try {
      const db = await this.dbPromise;
      const transaction = db.transaction(this.STORE_NAME, 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      await new Promise((resolve, reject) => {
        const request = store.put({ animeId, episodes, timestamp: Date.now() });
        request.onsuccess = () => resolve(undefined);
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.warn('[WatchHistoryDB] Failed to save:', err);
    }
  }

  async getWatchedEpisodes(animeId: string): Promise<any[] | null> {
    try {
      const db = await this.dbPromise;
      const transaction = db.transaction(this.STORE_NAME, 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      return new Promise((resolve, reject) => {
        const request = store.get(animeId);
        request.onsuccess = () => resolve(request.result?.episodes || null);
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.warn('[WatchHistoryDB] Failed to get:', err);
      return null;
    }
  }

  async getAllWatchedAnime(): Promise<Record<string, any[]>> {
    try {
      const db = await this.dbPromise;
      const transaction = db.transaction(this.STORE_NAME, 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => {
          const result: Record<string, any[]> = {};
          request.result.forEach((item: any) => {
            result[item.animeId] = item.episodes;
          });
          resolve(result);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.warn('[WatchHistoryDB] Failed to get all:', err);
      return {};
    }
  }
}

const watchHistoryDB = new WatchHistoryDB();

// ─── Safe localStorage helper ──────────────────────────────────────────────────
// Wraps every setItem so QuotaExceededError never bubbles up as an uncaught
// exception.  When the write fails we try once to evict the single largest
// key and retry; if it still fails we silently give up.
function safeLocalStorageSet(key: string, value: string): void {
  const tryWrite = () => localStorage.setItem(key, value);
  try {
    tryWrite();
  } catch (e) {
    if (!(e instanceof DOMException && e.name === 'QuotaExceededError')) {
      console.error('[localStorage] Unexpected write error:', e);
      return;
    }
    // Evict the single largest key and retry once
    try {
      let largest = '';
      let largestSize = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)!;
        const size = (localStorage.getItem(k) || '').length;
        if (size > largestSize) { largest = k; largestSize = size; }
      }
      if (largest) {
        console.warn(`[localStorage] Quota exceeded — evicting largest key: "${largest}" (${largestSize} chars)`);
        localStorage.removeItem(largest);
      }
      tryWrite();
    } catch {
      console.warn(`[localStorage] Could not write "${key}" even after eviction — skipping.`);
    }
  }
}

import {
  EpisodeList,
  Player,
  WatchAnimeData as AnimeData,
  AnimeDataList,
  MediaSource,
  fetchAnimeData,
  fetchAnimeInfo,
  fetchAnimeStreamingLinksProxied,
  fetchEpisodesFromMultipleProviders,
  type MergedEpisode,
  SkeletonPlayer,
  useCountdown,
  useAuth,
} from '../index';
import { Episode } from '../index';

// ─── Types ───────────────────────────────────────────────────────────────────

type ProviderEpisodeData = {
  id: string;
  provider: string;
  title: string;
  image: string;
  description: string;
  imageHash: string;
  airDate: string;
};

type WatchEpisode = Episode & {
  provider?: string;
  providers: Record<string, ProviderEpisodeData>;
};

// ─── Styled Components ───────────────────────────────────────────────────────

const WatchContainer = styled.div``;

const WatchWrapper = styled.div`
  font-size: 0.9rem;
  gap: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  background-color: var(--global-primary-bg);
  color: var(--global-text);

  @media (min-width: 1000px) {
    flex-direction: row;
    align-items: flex-start;
  }
`;

const DataWrapper = styled.div`
  display: grid;
  gap: 1rem;
  grid-template-columns: 1fr 1fr;
  width: 100%;
  @media (max-width: 1000px) {
    grid-template-columns: 1fr;
    max-width: 100%;
  }
`;

const SourceAndData = styled.div<{ $videoPlayerWidth: string }>`
  width: ${({ $videoPlayerWidth }) => $videoPlayerWidth};
  @media (max-width: 1000px) {
    width: 100%;
  }
`;

const RalationsTable = styled.div`
  padding: 0;
  margin-top: 1rem;
  @media (max-width: 1000px) {
    margin-top: 0rem;
  }
`;

const VideoPlayerContainer = styled.div`
  position: relative;
  width: 100%;
  border-radius: var(--global-border-radius);

  @media (min-width: 1000px) {
    flex: 3 1 0;
    min-width: 0;
  }
`;

const EpisodeListContainer = styled.div`
  width: 100%;
  max-height: 100%;

  @media (min-width: 1000px) {
    flex: 1 1 320px;
    max-width: 380px;
    max-height: 100%;
  }

  @media (max-width: 1000px) {
    padding-left: 0rem;
  }
`;

const NoEpsFoundDiv = styled.div`
  text-align: center;
  margin-top: 7.5rem;
  margin-bottom: 10rem;
  @media (max-width: 1000px) {
    margin-top: 2.5rem;
    margin-bottom: 6rem;
  }
`;

const NoEpsImage = styled.div`
  margin-bottom: 3rem;
  max-width: 100%;

  img {
    border-radius: var(--global-border-radius);
    max-width: 100%;
    @media (max-width: 500px) {
      max-width: 70%;
    }
  }
`;

const StyledHomeButton = styled.button`
  color: white;
  border-radius: var(--global-border-radius);
  border: none;
  background-color: var(--primary-accent);
  margin-top: 0.5rem;
  font-weight: bold;
  padding: 1rem;
  position: absolute;
  transform: translate(-50%, -50%);
  transition: transform 0.2s ease-in-out;
  &:hover,
  &:active,
  &:focus {
    transform: translate(-50%, -50%) scale(1.05);
  }
  &:active {
    transform: translate(-50%, -50%) scale(0.95);
  }
`;

const IframeTrailer = styled.iframe`
  position: relative;
  border-radius: var(--global-border-radius);
  border: none;
  top: 0;
  left: 0;
  width: 70%;
  height: 100%;
  text-items: center;
  @media (max-width: 1000px) {
    width: 100%;
    height: 100%;
  }
`;

// ─── Constants ────────────────────────────────────────────────────────────────

const LOCAL_STORAGE_KEYS = {
  LAST_WATCHED_EPISODE: 'last-watched-',
  LAST_ANIME_VISITED: 'last-anime-visited',
};

// Max episodes kept per anime in the lightweight localStorage cache
const MAX_CACHE_EPISODES_PER_ANIME = 30;
// Max number of anime entries kept in the localStorage cache
const MAX_CACHE_ANIME_ENTRIES = 50;

const PROVIDERS: string[] = ['anikoto', 'reanime', 'kickassanime', 'animepahe'];

const EMPTY_PROVIDERS: Record<string, ProviderEpisodeData> = {};

// ─── Helper: build an empty WatchEpisode ─────────────────────────────────────

function makeEmptyEpisode(): WatchEpisode {
  return {
    id: '0',
    number: 1,
    title: '',
    image: '',
    description: '',
    imageHash: '',
    airDate: '',
    provider: 'anikoto',
    providers: EMPTY_PROVIDERS,
  };
}

// ─── Main Component ───────────────────────────────────────────────────────────

const Watch: React.FC = () => {
  useAuth();

  // ── Refs ──────────────────────────────────────────────────────────────────
  const videoPlayerContainerRef = useRef<HTMLDivElement>(null);

  // ── Router ────────────────────────────────────────────────────────────────
  const { animeId } = useParams<{ animeId?: string }>();
  const [searchParams] = useSearchParams();
  const episodeNumber = searchParams.get('ep') || undefined;
  const navigate = useNavigate();

  // ── Storage helpers ───────────────────────────────────────────────────────
  const getLanguageKey = (id: string | undefined) => `subOrDub-[${id}]`;
  const getEpisodeServerKey = (id: string | undefined, epId: string | undefined) =>
    `episode-server-[${id}]-[${epId}]`;

  const getSavedServerForEpisode = (id?: string, epId?: string): string | null => {
    if (!id || !epId) return null;
    return localStorage.getItem(getEpisodeServerKey(id, epId)) || null;
  };

  const saveServerForEpisode = async (id: string, epId: string, server: string) => {
    safeLocalStorageSet(getEpisodeServerKey(id, epId), server);
    try {
      const { redisClient } = await import('../lib/caching/redisClient');
      await redisClient.set(`server-${id}-${epId}`, server, 30 * 24 * 60 * 60);
    } catch (err) {
      console.warn('[Watch] Failed to save server preference to Redis:', err);
    }
  };

  const STORAGE_KEYS = {
    SOURCE_TYPE: `source-[${animeId}]`,
    LANGUAGE: `subOrDub-[${animeId}]`,
  };

  // ── UI state ──────────────────────────────────────────────────────────────
  const [videoPlayerWidth, setVideoPlayerWidth] = useState('100%');
  const [maxEpisodeListHeight, setMaxEpisodeListHeight] = useState<string>('100%');
  const [selectedBackgroundImage, setSelectedBackgroundImage] = useState<string>('');
  const [showNoEpisodesMessage, setShowNoEpisodesMessage] = useState(false);
  const [lastKeypressTime, setLastKeypressTime] = useState(0);

  // ── Data state ────────────────────────────────────────────────────────────
  const [animeInfo, setAnimeInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [episodes, setEpisodes] = useState<WatchEpisode[]>([]);
  const hasFetchedEpisodesRef = useRef(false);
  const previousAnimeIdRef = useRef<string | undefined>(undefined);

  const [currentEpisode, setCurrentEpisode] = useState<WatchEpisode>(makeEmptyEpisode());

  // ── Language / sub-dub ────────────────────────────────────────────────────
  const [language, setLanguage] = useState(
    () => localStorage.getItem(STORAGE_KEYS.LANGUAGE) || 'sub',
  );
  const [languageChanged, setLanguageChanged] = useState(false);

  // ── Server / player state ─────────────────────────────────────────────────
  const [sourceType, setSourceType] = useState<string>('');
  const [downloadLink, setDownloadLink] = useState('');
  const [availableServers, setAvailableServers] = useState<string[]>([]);
  const [serverEntries, setServerEntries] = useState<
    Array<{ name: string; url: string; type: string; provider?: string }>
  >([]);
  const [embeddedUrl, setEmbeddedUrl] = useState<string>('');
  const [serverUrl, setServerUrl] = useState<string>('');
  const [embeddedServerName, setEmbeddedServerName] = useState<string>('');
  const [embeddedServerKeys, setEmbeddedServerKeys] = useState<Set<string>>(
    new Set(['embedded']),
  );
  const [hlsDirectUrl, setHlsDirectUrl] = useState<string>('');

  // ── Embedded player config ────────────────────────────────────────────────
  const EMBEDDED_PLAYER_1 = (import.meta.env.VITE_EMBEDDED_PLAYER_1 as string) || '';
  const hasEmbeddedPlayer = Boolean(EMBEDDED_PLAYER_1?.trim());
  const HENTAIMAMA_PROXY_URL = (import.meta.env.VITE_PROXY_HENTAIMAMA as string) || '';

  const getEmbeddedServerName = (lang: string) =>
    lang === 'dub' ? 'Zen Dub' : 'Zen Sub';

  const proxyHentaiUrl = (url: string, provider: string, type?: string) => {
    if (!url || (provider !== 'hentaimama' && provider !== 'watchhentai') || !HENTAIMAMA_PROXY_URL) return url;
    const isMp4 = /\.mp4$/i.test(url) || type === 'mp4';
    if (!isMp4) return url;
    return `${HENTAIMAMA_PROXY_URL.replace(/\/+$/, '')}/?url=${encodeURIComponent(url)}`;
  };

  const buildEmbeddedPlayerUrl = (
    id?: string,
    epNumber?: string,
    lang?: string,
  ) => {
    if (!hasEmbeddedPlayer || !id || !epNumber) return '';
    const cleanBase = EMBEDDED_PLAYER_1.replace(/\/+$/, '');
    const type = lang === 'dub' ? 'dub' : 'sub';
    const originalUrl = `${cleanBase}/stream/ani/${id}/${epNumber}/${type}`;
    const proxyUrl = import.meta.env.VITE_PROXY_URL;
    return proxyUrl ? `${proxyUrl}?url=${encodeURIComponent(originalUrl)}` : originalUrl;
  };

  // ── Countdown / airing ────────────────────────────────────────────────────
  const nextEpisodeAiringTime =
    animeInfo?.nextAiringEpisode ? animeInfo.nextAiringEpisode.airingTime * 1000 : null;
  const nextEpisodenumber = animeInfo?.nextAiringEpisode?.episode;
  const countdown = useCountdown(nextEpisodeAiringTime);

  // ── Derived indices ───────────────────────────────────────────────────────
  const currentEpisodeIndex = episodes.findIndex(
    (ep) => String(ep.id) === String(currentEpisode.id),
  );

  // ── Update video player width ─────────────────────────────────────────────
  const updateVideoPlayerWidth = useCallback(() => {
    if (videoPlayerContainerRef.current) {
      setVideoPlayerWidth(`${videoPlayerContainerRef.current.offsetWidth}px`);
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Internal navigation helpers
  // ─────────────────────────────────────────────────────────────────────────

  const GoToHomePageButton = () => {
    const nav = useNavigate();
    return (
      <StyledHomeButton onClick={() => nav('/home')}>Go back Home</StyledHomeButton>
    );
  };

  // ─── updateWatchedEpisodes ────────────────────────────────────────────────
  // Strategy:
  //   • Full history → IndexedDB  (no size limit, durable)
  //   • Minimal cache → localStorage  (capped: MAX_CACHE_ANIME_ENTRIES anime,
  //     MAX_CACHE_EPISODES_PER_ANIME eps each, only {id, number, title})
  //   • We NEVER dump the full IndexedDB contents back into localStorage.
  // ─────────────────────────────────────────────────────────────────────────
  const updateWatchedEpisodes = useCallback(
    (episode: Episode) => {
      if (!animeId) return;

      const saveToStorage = async () => {
        try {
          // 1. Full episode data → IndexedDB (unlimited quota)
          const existingEpisodes = await watchHistoryDB.getWatchedEpisodes(animeId);
          const episodeList = existingEpisodes || [];

          if (!episodeList.some((ep) => ep.id === episode.id)) {
            episodeList.push(episode);
            await watchHistoryDB.saveWatchedEpisodes(animeId, episodeList);
          }

          // 2. Minimal cache → localStorage (size-capped, non-critical)
          const CACHE_KEY = 'watched-episodes-cache';
          let allWatchedEpisodes: Record<string, { id: string; number: number; title: string }[]>;
          try {
            allWatchedEpisodes = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
          } catch {
            allWatchedEpisodes = {};
          }

          const animeWatchList = allWatchedEpisodes[animeId] || [];

          if (!animeWatchList.some((ep) => ep.id === episode.id)) {
            animeWatchList.push({ id: episode.id, number: episode.number, title: episode.title });

            // Cap per-anime episodes
            if (animeWatchList.length > MAX_CACHE_EPISODES_PER_ANIME) {
              animeWatchList.shift();
            }
            allWatchedEpisodes[animeId] = animeWatchList;

            // Cap total anime entries by evicting the oldest
            const animeKeys = Object.keys(allWatchedEpisodes);
            if (animeKeys.length > MAX_CACHE_ANIME_ENTRIES) {
              // Remove oldest entries (first keys) until within limit
              const toRemove = animeKeys.slice(0, animeKeys.length - MAX_CACHE_ANIME_ENTRIES);
              toRemove.forEach((k) => delete allWatchedEpisodes[k]);
            }

            safeLocalStorageSet(CACHE_KEY, JSON.stringify(allWatchedEpisodes));
          }
        } catch (err) {
          console.error('[Watch] Error saving watched episode:', err);
        }
      };

      saveToStorage();
    },
    [animeId],
  );

  useEffect(() => {
    if (currentEpisode?.id && currentEpisode.id !== '0') {
      updateWatchedEpisodes(currentEpisode);
    }
  }, [currentEpisode, updateWatchedEpisodes]);

  // NOTE: The previous `syncWatchHistory` effect that wrote ALL of IndexedDB
  // into localStorage has been removed.  It caused QuotaExceededError because
  // IndexedDB can hold megabytes of history while localStorage is limited to
  // ~5 MB.  IndexedDB already persists the data durably — no sync is needed.

  // ─────────────────────────────────────────────────────────────────────────
  // handleEpisodeSelect
  // ─────────────────────────────────────────────────────────────────────────
  const handleEpisodeSelect = useCallback(
    async (selected: WatchEpisode | (Episode & { provider?: string; providers?: Record<string, ProviderEpisodeData> })) => {
      let resolvedProviders: Record<string, ProviderEpisodeData> =
        (selected as WatchEpisode).providers || EMPTY_PROVIDERS;

      if (!resolvedProviders || Object.keys(resolvedProviders).length === 0) {
        const found = episodes.find(
          (ep) =>
            String(ep.number) === String((selected as any).number) ||
            String(ep.id) === String(selected.id),
        );
        resolvedProviders = found?.providers || EMPTY_PROVIDERS;
      }

      const primaryProvider =
        (selected as WatchEpisode).provider ||
        Object.keys(resolvedProviders)[0] ||
        'anikoto';

      const primaryId =
        resolvedProviders[primaryProvider]?.id || selected.id;

      const nextEpisode: WatchEpisode = {
        id: primaryId,
        number:
          typeof selected.number === 'string'
            ? parseInt(selected.number, 10)
            : selected.number,
        image: selected.image,
        title: selected.title,
        description: selected.description,
        imageHash: selected.imageHash,
        airDate: selected.airDate,
        provider: primaryProvider,
        providers: resolvedProviders,
      };

      setCurrentEpisode(nextEpisode);

      safeLocalStorageSet(
        LOCAL_STORAGE_KEYS.LAST_WATCHED_EPISODE + animeId,
        JSON.stringify({ id: primaryId, title: nextEpisode.title, number: nextEpisode.number }),
      );

      updateWatchedEpisodes(nextEpisode);

      navigate(`/watch/${animeId}?ep=${nextEpisode.number}`, { replace: true });
      await new Promise((resolve) => setTimeout(resolve, 100));
    },
    [animeId, navigate, episodes],
  );

  const updateDownloadLink = useCallback((link: string) => {
    setDownloadLink(link);
  }, []);

  const handleEpisodeEnd = async () => {
    const next = currentEpisodeIndex + 1;
    if (next >= episodes.length) return;
    handleEpisodeSelect(episodes[next]);
  };

  const onPrevEpisode = () => {
    const prev = currentEpisodeIndex - 1;
    if (prev >= 0) handleEpisodeSelect(episodes[prev]);
  };

  const onNextEpisode = () => {
    const next = currentEpisodeIndex + 1;
    if (next < episodes.length) handleEpisodeSelect(episodes[next]);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Effects
  // ─────────────────────────────────────────────────────────────────────────

  // Persist / restore language preference
  useEffect(() => {
    setLanguage(localStorage.getItem(getLanguageKey(animeId || '')) || 'sub');
  }, [animeId]);

  useEffect(() => {
    safeLocalStorageSet(getLanguageKey(animeId), language);
  }, [language, animeId]);

  // Keep embedded URL in sync with language / episode number
  useEffect(() => {
    if (!hasEmbeddedPlayer || !animeId || !currentEpisode.number) return;
    setEmbeddedUrl(buildEmbeddedPlayerUrl(animeId, currentEpisode.number.toString(), language));
    setEmbeddedServerName(getEmbeddedServerName(language));
  }, [animeId, currentEpisode.number, language, hasEmbeddedPlayer]);

  // Document title
  useEffect(() => {
    if (animeInfo?.title) {
      document.title =
        'Watch ' +
        (animeInfo.title.english || animeInfo.title.romaji || '') +
        ' | Zenime';
    }
  }, [animeInfo]);

  // Resize observer
  useEffect(() => {
    updateVideoPlayerWidth();
    window.addEventListener('resize', updateVideoPlayerWidth);
    return () => window.removeEventListener('resize', updateVideoPlayerWidth);
  }, [updateVideoPlayerWidth]);

  useEffect(() => {
    const update = () => {
      if (videoPlayerContainerRef.current) {
        setMaxEpisodeListHeight(`${videoPlayerContainerRef.current.offsetHeight}px`);
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // ── Fetch anime info ──────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    if (!animeId) return;
    (async () => {
      try {
        const info = await fetchAnimeData(animeId);
        if (mounted) setAnimeInfo(info);
      } catch {
        try {
          const fallback = await fetchAnimeInfo(animeId);
          if (mounted) setAnimeInfo(fallback);
        } catch (err) {
          console.error('Failed to fetch anime info:', err);
        }
      }
    })();
    return () => { mounted = false; };
  }, [animeId]);

  // ── Fetch + merge episodes from all providers ─────────────────────────────
  useEffect(() => {
    let mounted = true;
    if (!animeId || !animeInfo) return;

    if (previousAnimeIdRef.current !== animeId) {
      previousAnimeIdRef.current = animeId;
      hasFetchedEpisodesRef.current = false;
    }

    if (hasFetchedEpisodesRef.current && !languageChanged) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const isDub = language === 'dub';

        const isHentai =
          animeInfo?.genres?.some((g: string) => g.toLowerCase() === 'hentai');
        const providersToUse = isHentai ? ['hentaimama', 'watchhentai'] : PROVIDERS;
        console.log(`[Watch] isHentai=${isHentai}, providers:`, providersToUse);

        const mergedEpisodes: MergedEpisode[] = await fetchEpisodesFromMultipleProviders(
          animeId,
          isDub,
          providersToUse,
        );

        if (!mounted || mergedEpisodes.length === 0) return;

        const transformed: WatchEpisode[] = mergedEpisodes.map((mergedEp) => {
          let title = mergedEp.title || '';
          if (title) title = title.replace(/^\d+-\d+\.\s+/, '');

          const epNumber = parseInt(mergedEp.number, 10) || 1;

          const providerPriority = ['hentaimama', 'watchhentai', 'anikoto', 'reanime', 'kickassanime', 'animepahe'];
          let primaryProviderKey = Object.keys(mergedEp.providers)[0] || 'anikoto';

          for (const priorityProvider of providerPriority) {
            if (mergedEp.providers[priorityProvider]) {
              primaryProviderKey = priorityProvider;
              break;
            }
          }

          const primaryProviderData = mergedEp.providers[primaryProviderKey];

          return {
            id: primaryProviderData?.id || String(epNumber),
            number: epNumber,
            title: title || `Episode ${mergedEp.number}`,
            image: mergedEp.image,
            description: mergedEp.description,
            imageHash: mergedEp.imageHash,
            airDate: mergedEp.airDate,
            provider: primaryProviderKey,
            providers: mergedEp.providers as Record<string, ProviderEpisodeData>,
          };
        });

        setEpisodes(transformed);

        // Update last-visited (minimal data only)
        if (animeInfo && animeId) {
          let lvData: Record<string, any> = {};
          try {
            lvData = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.LAST_ANIME_VISITED) || '{}');
          } catch { /* ignore */ }
          lvData[animeId] = {
            timestamp: Date.now(),
            titleEnglish: animeInfo.title?.english,
            titleRomaji: animeInfo.title?.romaji,
          };
          // Cap the last-visited map to 100 entries
          const lvKeys = Object.keys(lvData);
          if (lvKeys.length > 100) {
            lvKeys
              .sort((a, b) => (lvData[a].timestamp ?? 0) - (lvData[b].timestamp ?? 0))
              .slice(0, lvKeys.length - 100)
              .forEach((k) => delete lvData[k]);
          }
          safeLocalStorageSet(LOCAL_STORAGE_KEYS.LAST_ANIME_VISITED, JSON.stringify(lvData));
        }

        // Determine which episode to navigate to
        const targetEp = (() => {
          if (languageChanged) {
            const num = episodeNumber || String(currentEpisode.number);
            return (
              transformed.find((ep) => String(ep.number) === num) ||
              transformed[transformed.length - 1]
            );
          }
          if (episodeNumber) {
            return transformed.find((ep) => String(ep.number) === episodeNumber) || transformed[0];
          }
          let savedEp: { number: number } | null = null;
          try {
            const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.LAST_WATCHED_EPISODE + animeId);
            savedEp = saved ? JSON.parse(saved) : null;
          } catch { /* ignore */ }
          return savedEp
            ? transformed.find((ep) => String(ep.number) === String(savedEp!.number)) || transformed[0]
            : transformed[0];
        })();

        if (targetEp) {
          if (String(targetEp.number) !== episodeNumber) {
            navigate(`/watch/${animeId}?ep=${targetEp.number}`, { replace: true });
          }
          setCurrentEpisode(targetEp);
          setLanguageChanged(false);
        }
        hasFetchedEpisodesRef.current = true;
      } catch (err) {
        console.error('Failed to fetch episodes from multiple providers:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchData();
    return () => { mounted = false; };
  }, [animeId, navigate, language, languageChanged, animeInfo]);

  useEffect(() => {
    if (!episodeNumber || episodes.length === 0) return;
    const selected = episodes.find((ep) => String(ep.number) === episodeNumber);
    if (selected && selected.id !== currentEpisode.id) {
      setCurrentEpisode(selected);
    }
  }, [episodeNumber, episodes, currentEpisode.id]);

  // ── Background image ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!animeInfo || currentEpisode.id === '0') return;
    const episodeImage = currentEpisode.image;
    const bannerImage = animeInfo?.cover || animeInfo?.artwork?.[3]?.img;
    if (episodeImage && episodeImage !== animeInfo.image) {
      const img = new Image();
      img.onload = () =>
        setSelectedBackgroundImage(img.width > 500 ? episodeImage : bannerImage);
      img.onerror = () => setSelectedBackgroundImage(bannerImage);
      img.src = episodeImage;
    } else {
      setSelectedBackgroundImage(bannerImage);
    }
  }, [animeInfo, currentEpisode]);

  // ── No-episodes timeout ───────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => {
      if (!episodes || episodes.length === 0) setShowNoEpisodesMessage(true);
    }, 10000);
    return () => clearTimeout(t);
  }, [loading, episodes]);

  useEffect(() => {
    setShowNoEpisodesMessage(!loading && episodes.length === 0);
  }, [loading, episodes]);

  // ── Reset player state when episode changes ───────────────────────────────
  useEffect(() => {
    if (currentEpisode.id && currentEpisode.id !== '0') {
      setSourceType('');
      setAvailableServers([]);
      setServerEntries([]);
      setEmbeddedUrl('');
      setServerUrl('');
      setHlsDirectUrl('');
      setEmbeddedServerKeys(new Set(['embedded']));
    }
  }, [currentEpisode.id]);

  // ── Fetch available servers from ALL providers for the current episode ────
  useEffect(() => {
    if (!currentEpisode.id || currentEpisode.id === '0') return;

    const fetchAvailableServers = async () => {
      const episodesByProvider: Record<string, string> = {};
      if (currentEpisode.providers && Object.keys(currentEpisode.providers).length > 0) {
        Object.entries(currentEpisode.providers).forEach(([provider, data]) => {
          if (provider === 'animekai') return;
          if (data?.id) {
            episodesByProvider[provider] = data.id;
          }
        });
      } else {
        const provider =
          currentEpisode.provider && currentEpisode.provider !== 'animekai'
            ? currentEpisode.provider
            : 'kickassanime';
        episodesByProvider[provider] = currentEpisode.id;
      }

      const providerList = Object.keys(episodesByProvider);

      console.log('[Watch] Fetching servers for providers:', episodesByProvider);

      if (providerList.length === 0) {
        console.warn('[Watch] No providers available for this episode');
        setAvailableServers([]);
        return;
      }

      const partialProviderResults: Array<{ provider: string; servers: any[]; response: any }> = [];

      const rebuildServerEntries = (serverResults: typeof partialProviderResults) => {
        const aggregatedServers: {
          name: string;
          provider: string;
          url: string;
          type: string;
          isEmbedded?: boolean;
        }[] = [];
        const urlSet = new Set<string>();
        let hasEmbeddedPlayer_ = false;
        const newEmbeddedServerKeys = new Set<string>(['embedded']);
        const providerNameCounters = new Map<string, number>();

        const normalizeAnikotoLabel = (
          name: string,
          type: string,
          quality?: string,
        ) => {
          const normalizedType = type?.toLowerCase();
          const normalizedQuality = (quality || name || '').toLowerCase();

          const label = normalizedQuality.includes('hsub') || normalizedType === 'hsub'
            ? 'Zen HSUB'
            : normalizedQuality.includes('dub') || normalizedType === 'dub'
              ? 'Zen Dub'
              : 'Zen Sub';

          const count = providerNameCounters.get(label) || 0;
          const uniqueLabel = count === 0 ? label : `${label} ${count + 1}`;
          providerNameCounters.set(label, count + 1);
          return uniqueLabel;
        };

        const isEmbeddedServer = (url: string, type?: string): boolean => {
          const normalizedType = type?.toLowerCase();
          return (
            url.includes('iframe') ||
            url.includes('kwik.cx') ||
            url.includes('flixcloud') ||
            normalizedType === 'iframe' ||
            normalizedType === 'sub' ||
            normalizedType === 'dub' ||
            normalizedType === 'hsub'
          );
        };

        const addServer = (
          name: string,
          url: string,
          provider: string,
          type: string,
          isEmbedded: boolean,
          quality?: string,
        ) => {
          const proxiedUrl = proxyHentaiUrl(url, provider, type);
          if (!proxiedUrl || urlSet.has(proxiedUrl)) return;

          const finalName = provider === 'anikoto'
            ? normalizeAnikotoLabel(name, type, quality)
            : name;

          urlSet.add(proxiedUrl);
          if (isEmbedded) hasEmbeddedPlayer_ = true;
          aggregatedServers.push({ name: finalName, provider, url: proxiedUrl, type, isEmbedded });
        };

        serverResults.forEach(({ provider, servers, response }) => {
          const isHentaiProvider = provider === 'hentaimama' || provider === 'watchhentai';

          if (!isHentaiProvider) {
            servers.forEach((server: any) => {
              const serverName = server?.name || '';
              const serverUrl = server?.url || '';
              if (!serverName || !serverUrl) return;
              if (provider === 'anikoto' && serverUrl.includes('.m3u8')) return;
              const type = server?.type || '';
              const embedded = isEmbeddedServer(serverUrl, type);
              addServer(serverName, serverUrl, provider, embedded ? 'iframe' : 'hls', embedded, server?.quality || '');
            });
          }

          if (!isHentaiProvider && response?.servers && Array.isArray(response.servers) && response.servers.length > 0) {
            const seenProviderName = new Set<string>();

            response.servers.forEach((srv: any) => {
              const sName = (srv?.name || '').trim();
              const sUrl = (srv?.url || '').trim();
              const sLang = (srv?.type || '').toLowerCase();

              if (!sName || !sUrl) return;

              const hasSublabel = sLang === 'sub' || sLang === 'dub';
              if (hasSublabel && sLang !== language) return;

              const nameKey = `${provider}:${sName}`;
              if (seenProviderName.has(nameKey)) return;
              seenProviderName.add(nameKey);

              const type = sLang || '';
              const isEmb = isEmbeddedServer(sUrl, type);
              addServer(sName, sUrl, provider, isEmb ? 'iframe' : 'hls', isEmb, sLang);
            });
          }

          if (response?.sources && Array.isArray(response.sources)) {
            let subCount = 0;
            let dubCount = 0;

            const providerPrefix = provider === 'watchhentai' ? 'WH ' : provider === 'hentaimama' ? 'HM ' : '';

            response.sources.forEach((source: any) => {
              const sourceUrl = source?.url || '';
              if (!sourceUrl || (!sourceUrl.includes('.m3u8') && !sourceUrl.includes('.mp4'))) return;
              if (provider === 'anikoto' && sourceUrl.includes('.m3u8')) return;

              const isDub = source.isDub === true;
              const type = sourceUrl.includes('.mp4') ? 'mp4' : 'hls';
              const qualityLabel = source?.quality || '';
              const sourceName = provider === 'anikoto'
                ? 'Zen Sub'
                : isDub
                  ? `${providerPrefix}Dub${++dubCount}`
                  : `${providerPrefix}Sub${++subCount}`;
              addServer(sourceName, sourceUrl, provider, type, false, qualityLabel);
            });
          }
        });

        const entries = aggregatedServers.map((server) => {
          const displayName = server.isEmbedded ? `${server.name}__EM` : server.name;
          if (server.isEmbedded) newEmbeddedServerKeys.add(displayName);
          return {
            name: displayName,
            url: server.url,
            type: server.type,
            provider: server.provider,
          };
        });

        setServerEntries(entries);
        setEmbeddedServerKeys(newEmbeddedServerKeys);

        if (hasEmbeddedPlayer && hasEmbeddedPlayer_) {
          setEmbeddedUrl(
            buildEmbeddedPlayerUrl(animeId, currentEpisode.number.toString(), language),
          );
          setEmbeddedServerName(getEmbeddedServerName(language));
        }

        const serverNames = entries.map((s) => s.name);
        console.log('[Watch] Aggregated available servers:', serverNames);
        setAvailableServers(serverNames);
      };

      try {
        const providerFetches = providerList.map(async (provider) => {
          const episodeId = episodesByProvider[provider];
          if (!episodeId) return;

          try {
            const response = await fetchAnimeStreamingLinksProxied(episodeId, provider);
            const servers = response?.servers || [];
            partialProviderResults.push({ provider, servers, response });
            rebuildServerEntries(partialProviderResults);
          } catch (err) {
            console.error(`[Watch] Failed to fetch servers for provider ${provider}:`, err);
          }
        });

        await Promise.all(providerFetches);
      } catch (err) {
        console.error('[Watch] Error fetching servers from multiple providers:', err);
      }
    };

    fetchAvailableServers();
  }, [currentEpisode.id, currentEpisode.providers, animeId, language]);

  // ── Resolve player URL when selected server changes ───────────────────────
  useEffect(() => {
    if (!currentEpisode.id || currentEpisode.id === '0' || !sourceType) return;

    if (sourceType === 'embedded') {
      if (hasEmbeddedPlayer) {
        setEmbeddedUrl(
          buildEmbeddedPlayerUrl(animeId, currentEpisode.number.toString(), language),
        );
      }
      setHlsDirectUrl('');
      return;
    }

    const isEmbeddedServer = sourceType.endsWith('__EM');
    const baseName = sourceType.replace(/__EM$/, '');

    if (isEmbeddedServer) {
      const entry = serverEntries.find(
        (s) => s.name.replace(/__EM$/, '').toLowerCase() === baseName.toLowerCase(),
      );
      if (entry?.url) {
        setEmbeddedUrl(entry.url);
        setServerUrl(entry.url);
        setHlsDirectUrl('');
      }
    } else {
      const entry = serverEntries.find((s) => {
        const nameMatch = s.name.toLowerCase() === baseName.toLowerCase();
        const typeMatch = s.type === 'hls' || s.type === 'mp4' || s.url?.includes('.m3u8') || s.url?.includes('.mp4');
        return nameMatch && typeMatch;
      });

      if (entry?.url) {
        const isDirectMedia = /\.m3u8$/i.test(entry.url) || /\/manifest\//i.test(entry.url) || /\.mp4/i.test(entry.url) || entry.type === 'mp4';
        setEmbeddedUrl('');
        setServerUrl(entry.url);
        setHlsDirectUrl(isDirectMedia ? entry.url : '');
      } else if (serverEntries.length > 0) {
        const fallbackEntry = serverEntries.find((e) =>
          e.name.toLowerCase().includes(baseName.toLowerCase()) && !e.name.includes('__EM')
        );
        if (fallbackEntry?.url) {
          const isDirectMedia = /\.m3u8$/i.test(fallbackEntry.url) || /\.mp4/i.test(fallbackEntry.url) || fallbackEntry.type === 'mp4';
          setEmbeddedUrl('');
          setServerUrl(fallbackEntry.url);
          setHlsDirectUrl(isDirectMedia ? fallbackEntry.url : '');
        }
      }
    }
  }, [
    currentEpisode.id,
    currentEpisode.provider,
    sourceType,
    serverEntries,
    language,
    hasEmbeddedPlayer,
    animeId,
  ]);

  // ── Auto-select server as soon as any provider returns a result ──────────
  useEffect(() => {
    if (!currentEpisode.id || currentEpisode.id === '0') return;
    if (sourceType) return;
    if (availableServers.length === 0) return;

    const saved = getSavedServerForEpisode(animeId, currentEpisode.id);
    if (saved && availableServers.includes(saved)) {
      console.log('[Watch] Restoring saved server:', saved);
      setSourceType(saved);
      return;
    }

    const embeddedServerCandidate = availableServers.find((server) =>
      embeddedServerKeys.has(server),
    );
    if (embeddedServerCandidate) {
      console.log('[Watch] Auto-selecting embedded server:', embeddedServerCandidate);
      setSourceType(embeddedServerCandidate);
      return;
    }

    console.log('[Watch] Auto-selecting first available server:', availableServers[0]);
    setSourceType(availableServers[0]);
  }, [availableServers, embeddedServerKeys, sourceType, animeId, currentEpisode.id]);

  // ── Persist server selection per episode ──────────────────────────────────
  useEffect(() => {
    if (animeId && currentEpisode.id && currentEpisode.id !== '0' && sourceType) {
      saveServerForEpisode(animeId, currentEpisode.id, sourceType);
    }
  }, [sourceType, animeId, currentEpisode.id]);

  // ── Keyboard shortcuts (Shift+N / Shift+P) ───────────────────────────────
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement).tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      if (!event.shiftKey || !['N', 'P'].includes(event.key.toUpperCase())) return;
      const now = Date.now();
      if (now - lastKeypressTime < 200) return;
      setLastKeypressTime(now);
      const idx = episodes.findIndex((ep) => String(ep.id) === String(currentEpisode.id));
      if (event.key.toUpperCase() === 'N' && idx < episodes.length - 1) {
        handleEpisodeSelect(episodes[idx + 1]);
      } else if (event.key.toUpperCase() === 'P' && idx > 0) {
        handleEpisodeSelect(episodes[idx - 1]);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [episodes, currentEpisode, handleEpisodeSelect, lastKeypressTime]);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <WatchContainer>
      {animeInfo && animeInfo.status === 'Not yet aired' && animeInfo.trailer ? (
        <div style={{ textAlign: 'center' }}>
          <strong><h2>Time Remaining:</h2></strong>
          {animeInfo.nextAiringEpisode ? (
            countdown === 'Airing now or aired' ? (
              <p><strong>Airing now or aired</strong></p>
            ) : (
              <p><FaBell /> {countdown}</p>
            )
          ) : (
            <p>Unknown</p>
          )}
          {animeInfo.trailer && (
            <IframeTrailer
              src={`https://www.youtube.com/embed/${animeInfo.trailer.id}`}
              allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
              allowFullScreen
            />
          )}
        </div>
      ) : showNoEpisodesMessage ? (
        <NoEpsFoundDiv>
          <h2>No episodes found {':('}</h2>
          <NoEpsImage>
            <img src={Image404URL} alt='404 Error' />
          </NoEpsImage>
          <GoToHomePageButton />
        </NoEpsFoundDiv>
      ) : (
        <WatchWrapper>
          {!showNoEpisodesMessage && (
            <>
              <VideoPlayerContainer ref={videoPlayerContainerRef}>
                {loading ? (
                  <SkeletonPlayer />
                ) : (
                  <Player
                    episodeId={currentEpisode.id}
                    episodeNumber={currentEpisode.number}
                    episodeProvider={currentEpisode.provider}
                    malId={animeInfo?.malId}
                    animeId={animeId}
                    totalEpisodes={animeInfo?.totalEpisodes}
                    banner={selectedBackgroundImage}
                    updateDownloadLink={updateDownloadLink}
                    onEpisodeEnd={handleEpisodeEnd}
                    onPrevEpisode={onPrevEpisode}
                    onNextEpisode={onNextEpisode}
                    animeTitle={animeInfo?.title?.english || animeInfo?.title?.romaji}
                    sourceType={sourceType}
                    embeddedUrl={embeddedUrl}
                    serverUrl={serverUrl}
                    embeddedServerKeys={embeddedServerKeys}
                    hlsDirectUrl={hlsDirectUrl}
                  />
                )}
              </VideoPlayerContainer>

              <EpisodeListContainer style={{ maxHeight: maxEpisodeListHeight }}>
                {loading ? (
                  <SkeletonPlayer />
                ) : (
                  <EpisodeList
                    animeId={animeId}
                    episodes={episodes}
                    selectedEpisodeId={currentEpisode.id}
                    onEpisodeSelect={(episodeId: string) => {
                      const ep = episodes.find((e) => e.id === episodeId);
                      if (ep) handleEpisodeSelect(ep);
                    }}
                    maxListHeight={maxEpisodeListHeight}
                  />
                )}
              </EpisodeListContainer>
            </>
          )}
        </WatchWrapper>
      )}

      <DataWrapper>
        <SourceAndData $videoPlayerWidth={videoPlayerWidth}>
          {animeInfo && animeInfo.status !== 'Not yet aired' && (
            <MediaSource
              sourceType={sourceType}
              setSourceType={setSourceType}
              downloadLink={downloadLink}
              episodeId={currentEpisode.number.toString()}
              airingTime={animeInfo?.status === 'Ongoing' ? countdown : undefined}
              nextEpisodenumber={nextEpisodenumber}
              availableServers={availableServers}
              embeddedServerName={embeddedServerName}
              embeddedServerKeys={embeddedServerKeys}
            />
          )}
          {animeInfo && <AnimeData animeData={animeInfo} />}
        </SourceAndData>
        <RalationsTable>
          {animeInfo && <AnimeDataList animeData={animeInfo} />}
        </RalationsTable>
      </DataWrapper>
    </WatchContainer>
  );
};

export default Watch;
