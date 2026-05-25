import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { FaBell } from 'react-icons/fa';
import styled from 'styled-components';
import Image404URL from '/src/assets/404.webp';
import {
  EpisodeList,
  Player,
  WatchAnimeData as AnimeData,
  AnimeDataList,
  MediaSource,
  fetchAnimeData,
  fetchAnimeInfo,
  fetchEpisodesFromMultipleProviders,
  fetchServersFromMultipleProviders,
  type MergedEpisode,
  SkeletonPlayer,
  useCountdown,
  useAuth,
} from '../index';
import { Episode } from '../index';

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * A WatchEpisode always carries the full `providers` map so that
 * fetchAvailableServers can look up each provider's own episode ID.
 */
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
  /** The primary provider key (first available). */
  provider?: string;
  /** Full map of every provider that has this episode, keyed by provider name. */
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
  WATCHED_EPISODES: 'watched-episodes-',
  LAST_ANIME_VISITED: 'last-anime-visited',
};

const PROVIDERS: string[] = ['kickassanime', 'animepahe', 'reanime'];

/** Empty providers map used as the initial/fallback value. */
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
    provider: 'kickassanime',
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
    localStorage.setItem(getEpisodeServerKey(id, epId), server);
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

  /**
   * currentEpisode always carries the full `providers` map so that
   * the server-fetching effect can look up each provider's own episode ID.
   */
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
  const [hasFetchedServers, setHasFetchedServers] = useState<boolean>(false);
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

  const getEmbeddedServerName = (lang: string) =>
    lang === 'dub' ? 'Zen Dub' : 'Zen Sub';

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

  const updateWatchedEpisodes = useCallback(
    (episode: Episode) => {
      if (!animeId) return;

      const globalKey = 'watched-episodes';
      const allWatchedEpisodes: Record<string, Episode[]> = JSON.parse(
        localStorage.getItem(globalKey) || '{}',
      );
      const animeWatchList = allWatchedEpisodes[animeId] || [];

      if (!animeWatchList.some((ep) => ep.id === episode.id)) {
        const updatedAnimeWatchList = [...animeWatchList, episode];
        allWatchedEpisodes[animeId] = updatedAnimeWatchList;
        localStorage.setItem(globalKey, JSON.stringify(allWatchedEpisodes));
        localStorage.setItem(
          `${LOCAL_STORAGE_KEYS.WATCHED_EPISODES}${animeId}`,
          JSON.stringify(updatedAnimeWatchList),
        );
      }
    },
    [animeId],
  );

  useEffect(() => {
    if (currentEpisode?.id && currentEpisode.id !== '0') {
      updateWatchedEpisodes(currentEpisode);
    }
  }, [currentEpisode, updateWatchedEpisodes]);

  // ─────────────────────────────────────────────────────────────────────────
  // handleEpisodeSelect
  //
  // KEY FIX: carry `providers` forward from the episodes list so that the
  // server-fetching effect always has every provider's episode ID.
  // ─────────────────────────────────────────────────────────────────────────
  const handleEpisodeSelect = useCallback(
    async (selected: WatchEpisode | (Episode & { provider?: string; providers?: Record<string, ProviderEpisodeData> })) => {
      // Resolve the full providers map — prefer the one attached to the episode
      // object, but fall back to looking it up in the episodes list by number.
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

      // Determine the primary provider (first key in the map)
      const primaryProvider =
        (selected as WatchEpisode).provider ||
        Object.keys(resolvedProviders)[0] ||
        'kickassanime';

      // The primary episode ID comes from the primary provider's data.
      // This is the ID we store for display / last-watched purposes.
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
        providers: resolvedProviders, // ← full map, always
      };

      setCurrentEpisode(nextEpisode);

      localStorage.setItem(
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
    localStorage.setItem(getLanguageKey(animeId), language);
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
  //
  // KEY FIX: episodes are fetched per provider individually and merged by
  // episode number. Each WatchEpisode stores the full `providers` map so that
  // when a user selects an episode we know every provider's own episode ID.
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    if (!animeId) return;

    // If the anime changes, allow the next fetch to run.
    if (previousAnimeIdRef.current !== animeId) {
      previousAnimeIdRef.current = animeId;
      hasFetchedEpisodesRef.current = false;
    }

    if (hasFetchedEpisodesRef.current && !languageChanged) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const isDub = language === 'dub';

        // Fetch from all providers in parallel; each may return a different
        // episode ID for the same episode number.
        const mergedEpisodes: MergedEpisode[] = await fetchEpisodesFromMultipleProviders(
          animeId,
          isDub,
          PROVIDERS,
        );

        if (!mounted || mergedEpisodes.length === 0) return;

        // Transform into WatchEpisodes, preserving every provider's data
        const transformed: WatchEpisode[] = mergedEpisodes.map((mergedEp) => {
          let title = mergedEp.title || '';
          if (title) title = title.replace(/^\d+-\d+\.\s+/, '');

          const epNumber = parseInt(mergedEp.number, 10) || 1;

          // Primary provider is the first key in the providers map
          const primaryProviderKey = Object.keys(mergedEp.providers)[0] || 'kickassanime';
          const primaryProviderData = mergedEp.providers[primaryProviderKey];

          return {
            // Use the primary provider's episode ID as the canonical ID
            id: primaryProviderData?.id || String(epNumber),
            number: epNumber,
            title: title || `Episode ${mergedEp.number}`,
            image: mergedEp.image,
            description: mergedEp.description,
            imageHash: mergedEp.imageHash,
            airDate: mergedEp.airDate,
            provider: primaryProviderKey,
            // Full providers map — this is what makes multi-provider servers work
            providers: mergedEp.providers as Record<string, ProviderEpisodeData>,
          };
        });

        setEpisodes(transformed);

        // Update last-visited
        if (animeInfo && animeId) {
          const lv = localStorage.getItem(LOCAL_STORAGE_KEYS.LAST_ANIME_VISITED);
          const lvData = lv ? JSON.parse(lv) : {};
          lvData[animeId] = {
            timestamp: Date.now(),
            titleEnglish: animeInfo.title?.english,
            titleRomaji: animeInfo.title?.romaji,
          };
          localStorage.setItem(LOCAL_STORAGE_KEYS.LAST_ANIME_VISITED, JSON.stringify(lvData));
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
          const saved = localStorage.getItem(LOCAL_STORAGE_KEYS.LAST_WATCHED_EPISODE + animeId);
          const savedEp = saved ? JSON.parse(saved) : null;
          return savedEp
            ? transformed.find((ep) => String(ep.number) === String(savedEp.number)) || transformed[0]
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
  }, [animeId, navigate, language, languageChanged]);

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
      setHasFetchedServers(false);
      setServerEntries([]);
      setEmbeddedUrl('');
      setServerUrl('');
      setHlsDirectUrl('');
      setEmbeddedServerKeys(new Set(['embedded']));
    }
  }, [currentEpisode.id]);

  // ── Fetch available servers from ALL providers for the current episode ────
  //
  // KEY FIX: We build `episodesByProvider` from `currentEpisode.providers`
  // so each provider gets its OWN episode ID (they differ across providers).
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentEpisode.id || currentEpisode.id === '0') return;

    const fetchAvailableServers = async () => {
      setHasFetchedServers(false);

      // Build provider -> episodeId map from the stored providers data
      const episodesByProvider: Record<string, string> = {};
      if (currentEpisode.providers && Object.keys(currentEpisode.providers).length > 0) {
        Object.entries(currentEpisode.providers).forEach(([provider, data]) => {
          if (provider === 'animekai') return;
          if (data?.id) {
            episodesByProvider[provider] = data.id;
          }
        });
      } else {
        // Fallback: only the primary provider
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
        setHasFetchedServers(true);
        return;
      }

      try {
        // Each provider fetches with ITS OWN episode ID in parallel
        const serverResults = await fetchServersFromMultipleProviders(
          episodesByProvider,
          providerList,
          language,
        );

        const aggregatedServers: {
          name: string;
          provider: string;
          url: string;
          type: string;
          isEmbedded?: boolean;
        }[] = [];
        const urlSet = new Set<string>(); // Track URLs to avoid exact duplicates
        let hasEmbeddedPlayer_ = false;
        const newEmbeddedServerKeys = new Set<string>(['embedded']);

        // Helper: Detect if a server is embedded based on URL patterns
        const isEmbeddedServer = (url: string, type?: string): boolean => {
          return (
            url.includes('iframe') ||
            url.includes('kwik.cx') ||
            url.includes('flixcloud') ||
            type === 'iframe' ||
            // ReAnime returns type:"sub" | "dub" for flixcloud servers.
            // If the URL is flixcloud the check above already fires, but guard
            // here too so any future provider using the same convention works.
            ((type === 'sub' || type === 'dub') && url.includes('flixcloud'))
          );
        };

        // Helper: Add a server to aggregated list if not already present
        const addServer = (
          name: string,
          url: string,
          provider: string,
          type: string,
          isEmbedded: boolean,
        ) => {
          if (!url || urlSet.has(url)) return; // Skip if URL already added
          urlSet.add(url);
          if (isEmbedded) hasEmbeddedPlayer_ = true;
          aggregatedServers.push({ name, provider, url, type, isEmbedded });
        };

        // Process each provider's results
        serverResults.forEach(({ provider, servers, response }) => {
          // ── Standard server list (kickassanime, animepahe, …) ───────────────
          // These entries may or may not carry a `.url` field.  We only keep
          // entries that have a URL; the ones without are handled below.
          servers.forEach((server: any) => {
            const serverName = server?.name || '';
            const serverUrl = server?.url || '';
            if (!serverName || !serverUrl) return;
            const embedded = isEmbeddedServer(serverUrl, server.type);
            addServer(serverName, serverUrl, provider, embedded ? 'iframe' : 'hls', embedded);
          });

          // ── ReAnime-format: response.servers with type "sub" | "dub" ────────
          //
          // ReAnime (and providers that embed flixcloud.cc) return full server
          // objects directly in response.servers:
          //   { name: "HD-1", url: "https://flixcloud.cc/e/…", type: "sub" }
          //
          // fetchServersFromMultipleProviders may surface these as `servers`
          // above (in which case addServer's urlSet dedup makes this a no-op),
          // OR it may only return availableServers (string names) and leave the
          // full objects only in `response.servers`.  We always read from
          // response.servers here so both cases are covered.
          //
          // Key behaviours:
          //   1. Filter by current `language` — only keep the sub OR dub variant
          //      that matches what the user selected.
          //   2. Per-name dedup within this provider — avoids duplicating a
          //      server whose URL was already added by the `servers` loop above.
          if (response?.servers && Array.isArray(response.servers) && response.servers.length > 0) {
            const seenProviderName = new Set<string>();

            response.servers.forEach((srv: any) => {
              const sName   = (srv?.name || '').trim();
              const sUrl    = (srv?.url  || '').trim();
              const sLang   = (srv?.type || '').toLowerCase(); // 'sub' | 'dub' | ''

              if (!sName || !sUrl) return;

              // Language filter: if the server declares sub/dub affinity,
              // only keep the one that matches the current language setting.
              const hasSublabel = sLang === 'sub' || sLang === 'dub';
              if (hasSublabel && sLang !== language) return;

              // Per-provider-name dedup (URL-level dedup is inside addServer).
              const nameKey = `${provider}:${sName}`;
              if (seenProviderName.has(nameKey)) return;
              seenProviderName.add(nameKey);

              const isEmb = isEmbeddedServer(sUrl, sLang);
              addServer(sName, sUrl, provider, isEmb ? 'iframe' : 'hls', isEmb);
            });
          }

          // ── HLS sources (direct .m3u8 streams) ──────────────────────────────
          if (response?.sources && Array.isArray(response.sources)) {
            let subCount = 0;
            let dubCount = 0;

            response.sources.forEach((source: any) => {
              const sourceUrl = source?.url || '';
              if (!sourceUrl || !sourceUrl.includes('.m3u8')) return;

              const isDub = source.isDub === true;
              const sourceName = isDub ? `Dub ${++dubCount}` : `Sub ${++subCount}`;
              addServer(sourceName, sourceUrl, provider, 'hls', false);
            });
          }
        });

        // Build server entries with display names
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
      } catch (err) {
        console.error('[Watch] Error fetching servers from multiple providers:', err);
        setAvailableServers([]);
      } finally {
        setHasFetchedServers(true);
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

    // Check if this is an embedded server (with __EM suffix)
    const isEmbeddedServer = sourceType.endsWith('__EM');
    const baseName = sourceType.replace(/__EM$/, '');

    if (isEmbeddedServer) {
      // Handle embedded/iframe server
      const entry = serverEntries.find(
        (s) => s.name.replace(/__EM$/, '').toLowerCase() === baseName.toLowerCase(),
      );
      if (entry?.url) {
        setEmbeddedUrl(entry.url);
        setServerUrl(entry.url);
        setHlsDirectUrl('');
      }
    } else {
      // Handle HLS/non-embedded source
      const entry = serverEntries.find((s) => {
        const nameMatch = s.name.toLowerCase() === baseName.toLowerCase();
        const typeMatch = s.type === 'hls' || s.url?.includes('.m3u8');
        return nameMatch && typeMatch;
      });

      if (entry?.url) {
        const isDirectM3u8 = /\.m3u8$/i.test(entry.url) || /\/manifest\//i.test(entry.url);
        setEmbeddedUrl('');
        setServerUrl(entry.url);
        setHlsDirectUrl(isDirectM3u8 ? entry.url : '');
      } else if (serverEntries.length > 0) {
        // Fallback: try to find by partial match
        const fallbackEntry = serverEntries.find((e) => 
          e.name.toLowerCase().includes(baseName.toLowerCase()) && !e.name.includes('__EM')
        );
        if (fallbackEntry?.url) {
          const isDirectM3u8 = /\.m3u8$/i.test(fallbackEntry.url);
          setEmbeddedUrl('');
          setServerUrl(fallbackEntry.url);
          setHlsDirectUrl(isDirectM3u8 ? fallbackEntry.url : '');
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

  // ── Auto-select server once servers are fetched ───────────────────────────
  useEffect(() => {
    if (!hasFetchedServers) return;
    const saved = getSavedServerForEpisode(animeId, currentEpisode.id);
    if (saved && (availableServers.includes(saved) || saved === 'embedded')) {
      console.log('[Watch] Restoring saved server:', saved);
      setSourceType(saved);
    } else if (availableServers.length > 0) {
      console.log('[Watch] Auto-selecting first server:', availableServers[0]);
      setSourceType(availableServers[0]);
    } else if (hasEmbeddedPlayer) {
      console.log('[Watch] Falling back to embedded player');
      setSourceType('embedded');
    }
  }, [availableServers, hasEmbeddedPlayer, hasFetchedServers]);

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
          {animeInfo.nextAiringEpisode && countdown !== 'Airing now or aired' ? (
            <p><FaBell /> {countdown}</p>
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