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
  fetchAnimeEpisodes,
  fetchAnimeData,
  fetchAnimeInfo,
  fetchAnimeStreamingLinks,
  SkeletonPlayer,
  useCountdown,
} from '../index';
import { Episode } from '../index';

type WatchEpisode = Episode & { provider?: string };

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
  grid-template-columns: 1fr 1fr; // TODO Aim for a 3:1 ratio
  width: 100%; // TODO Make sure this container can expand enough
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

const LOCAL_STORAGE_KEYS = {
  LAST_WATCHED_EPISODE: 'last-watched-',
  WATCHED_EPISODES: 'watched-episodes-',
  LAST_ANIME_VISITED: 'last-anime-visited',
};

// TODO Main Component
const Watch: React.FC = () => {
  const videoPlayerContainerRef = useRef<HTMLDivElement>(null);
  const [videoPlayerWidth, setVideoPlayerWidth] = useState('100%');
  const getLanguageKey = (animeId: string | undefined) =>
    `subOrDub-[${animeId}]`;
  
  // Per-episode server storage keys
  const getEpisodeServerKey = (animeId: string | undefined, episodeId: string | undefined) =>
    `episode-server-[${animeId}]-[${episodeId}]`;
  
  const getSavedServerForEpisode = (animeId: string | undefined, episodeId: string | undefined) => {
    if (!animeId || !episodeId) return null;
    return localStorage.getItem(getEpisodeServerKey(animeId, episodeId)) || null;
  };
  
  const saveServerForEpisode = (animeId: string | undefined, episodeId: string | undefined, server: string) => {
    if (!animeId || !episodeId) return;
    localStorage.setItem(getEpisodeServerKey(animeId, episodeId), server);
  };
  
  const updateVideoPlayerWidth = useCallback(() => {
    if (videoPlayerContainerRef.current) {
      const width = `${videoPlayerContainerRef.current.offsetWidth}px`;
      setVideoPlayerWidth(width);
    }
  }, [setVideoPlayerWidth, videoPlayerContainerRef]);
  const [maxEpisodeListHeight, setMaxEpisodeListHeight] =
    useState<string>('100%');
  const { animeId } = useParams<{
    animeId?: string;
  }>();
  const [searchParams] = useSearchParams();
  const episodeNumber = searchParams.get('ep') || undefined;
  const STORAGE_KEYS = {
    SOURCE_TYPE: `source-[${animeId}]`,
    LANGUAGE: `subOrDub-[${animeId}]`,
  };
  const navigate = useNavigate();
  const [selectedBackgroundImage, setSelectedBackgroundImage] =
    useState<string>('');
  const [episodes, setEpisodes] = useState<WatchEpisode[]>([]);
  const [currentEpisode, setCurrentEpisode] = useState<WatchEpisode>({
    id: '0',
    number: 1,
    title: '',
    image: '',
    description: '',
    imageHash: '',
    airDate: '',
    provider: 'kickassanime',
  });
  const [animeInfo, setAnimeInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showNoEpisodesMessage, setShowNoEpisodesMessage] = useState(false);
  const [lastKeypressTime, setLastKeypressTime] = useState(0);
  const [sourceType, setSourceType] = useState<string>('');
  const [language, setLanguage] = useState(
    () => localStorage.getItem(STORAGE_KEYS.LANGUAGE) || 'sub',
  );
  const [downloadLink, setDownloadLink] = useState('');
  const [availableServers, setAvailableServers] = useState<string[]>([]);
  const [hasFetchedServers, setHasFetchedServers] = useState<boolean>(false);
  const [serverEntries, setServerEntries] = useState<
    Array<{ name: string; url: string; type: string }>
  >([]);
  const [embeddedUrl, setEmbeddedUrl] = useState<string>('');
  const [serverUrl, setServerUrl] = useState<string>('');
  const [embeddedServerName, setEmbeddedServerName] = useState<string>('');
  // Tracks which server keys render as iframes vs HLS
  const [embeddedServerKeys, setEmbeddedServerKeys] = useState<Set<string>>(
    new Set(['embedded']),
  );
  // HLS (M3U8) sources extracted from animekai API response
  const [animekaiHlsSources, setAnimekaiHlsSources] = useState<
    Array<{ name: string; url: string }>
  >([]);
  // Direct M3U8 URL to pass to Player when an animekai HLS server is selected
  const [hlsDirectUrl, setHlsDirectUrl] = useState<string>('');
  // Subtitles extracted from animekai API response (used for HLS playback)
  const [animekaiSubtitles, setAnimekaiSubtitles] = useState<
    Array<{ url: string; lang: string }>
  >([]);
  const EMBEDDED_PLAYER_1 = (import.meta.env.VITE_EMBEDDED_PLAYER_1 as string) || '';
  const hasEmbeddedPlayer = Boolean(EMBEDDED_PLAYER_1?.trim());

  const getEmbeddedServerName = (lang: string) =>
    lang === 'dub' ? 'Zen Dub' : 'Zen Sub';

  const buildEmbeddedPlayerUrl = (
    animeId?: string,
    episodeNumber?: string,
    lang?: string,
  ) => {
    if (!hasEmbeddedPlayer || !animeId || !episodeNumber) return '';
    const cleanBase = EMBEDDED_PLAYER_1.replace(/\/+$/, '');
    const type = lang === 'dub' ? 'dub' : 'sub';
    const originalUrl = `${cleanBase}/stream/ani/${animeId}/${episodeNumber}/${type}`;
    const proxyUrl = import.meta.env.VITE_PROXY_URL;
    if (proxyUrl) {
      return `${proxyUrl}?url=${encodeURIComponent(originalUrl)}`;
    } else {
      return originalUrl;
    }
  };

  /**
   * Build a proxied iframe URL for kickassanime servers.
   * Converts a raw kickassanime server URL to use the kickassanime-specific proxy
   * with the /url?= format.
   */
  const buildKickassanimeIframeUrl = (serverUrl: string) => {
    if (!serverUrl) return '';
    const proxyUrl = (import.meta.env.VITE_EMBEDDED_PROXY_KICKASSANIME as string) || '';
    if (proxyUrl) {
      return `${proxyUrl}/url?=${encodeURIComponent(serverUrl)}`;
    } else {
      return serverUrl;
    }
  };

  const nextEpisodeAiringTime =
    animeInfo && animeInfo.nextAiringEpisode
      ? animeInfo.nextAiringEpisode.airingTime * 1000
      : null;
  const nextEpisodenumber = animeInfo?.nextAiringEpisode?.episode;
  const countdown = useCountdown(nextEpisodeAiringTime);
  const currentEpisodeIndex = episodes.findIndex(
    (ep) => String(ep.id) === String(currentEpisode.id),
  );
  const [languageChanged, setLanguageChanged] = useState(false);

  //----------------------------------------------MORE VARIABLES----------------------------------------------
  const GoToHomePageButton = () => {
    const navigate = useNavigate();

    const handleClick = () => {
      navigate('/home');
    };

    return (
      <StyledHomeButton onClick={handleClick}>Go back Home</StyledHomeButton>
    );
  };
  // TODO SAVE TO LOCAL STORAGE NAVIGATED/CLICKED EPISODES
  const updateWatchedEpisodes = (episode: Episode) => {
    const watchedEpisodesJson = localStorage.getItem(
      LOCAL_STORAGE_KEYS.WATCHED_EPISODES + animeId,
    );
    const watchedEpisodes: Episode[] = watchedEpisodesJson
      ? JSON.parse(watchedEpisodesJson)
      : [];
    if (!watchedEpisodes.some((ep) => ep.id === episode.id)) {
      watchedEpisodes.push(episode);
      localStorage.setItem(
        LOCAL_STORAGE_KEYS.WATCHED_EPISODES + animeId,
        JSON.stringify(watchedEpisodes),
      );
    }
  };

  // TODO UPDATES CURRENT EPISODE INFORMATION, UPDATES WATCHED EPISODES AND NAVIGATES TO NEW URL
  const handleEpisodeSelect = useCallback(
    async (selectedEpisode: Episode & { provider?: string }) => {
      setCurrentEpisode({
        id: selectedEpisode.id,
        number: selectedEpisode.number,
        image: selectedEpisode.image,
        title: selectedEpisode.title,
        description: selectedEpisode.description,
        imageHash: selectedEpisode.imageHash,
        airDate: selectedEpisode.airDate,
        provider: selectedEpisode.provider || 'kickassanime',
      });

      localStorage.setItem(
        LOCAL_STORAGE_KEYS.LAST_WATCHED_EPISODE + animeId,
        JSON.stringify({
          id: selectedEpisode.id,
          title: selectedEpisode.title,
          number: selectedEpisode.number,
        }),
      );
      updateWatchedEpisodes(selectedEpisode);

      navigate(
        `/watch/${animeId}?ep=${selectedEpisode.number}`,
        {
          replace: true,
        },
      );
      await new Promise((resolve) => setTimeout(resolve, 100));
    },
    [animeId, navigate],
  );

  // TODO UPDATE DOWNLOAD LINK WHEN EPISODE ID CHANGES
  const updateDownloadLink = useCallback((link: string) => {
    setDownloadLink(link);
  }, []);

  // TODO AUTOPLAY BUTTON TOGGLE PROPS
  const handleEpisodeEnd = async () => {
    const nextEpisodeIndex = currentEpisodeIndex + 1;
    if (nextEpisodeIndex >= episodes.length) {
      console.log('No more episodes.');
      return;
    }
    handleEpisodeSelect(episodes[nextEpisodeIndex]);
  };

  // TODO NAVIGATE TO NEXT AND PREVIOUS EPISODES WITH SHIFT+N/P KEYBOARD COMBINATIONS (500MS DELAY)
  const onPrevEpisode = () => {
    const prevIndex = currentEpisodeIndex - 1;
    if (prevIndex >= 0) {
      handleEpisodeSelect(episodes[prevIndex]);
    }
  };
  const onNextEpisode = () => {
    const nextIndex = currentEpisodeIndex + 1;
    if (nextIndex < episodes.length) {
      handleEpisodeSelect(episodes[nextIndex]);
    }
  };

  //----------------------------------------------USEFFECTS----------------------------------------------
  useEffect(() => {
    const defaultLanguage = 'sub';
    setLanguage(
      localStorage.getItem(getLanguageKey(animeId || '')) || defaultLanguage,
    );
  }, [animeId]);

  useEffect(() => {
    localStorage.setItem(getLanguageKey(animeId), language);
  }, [language, animeId]);

  useEffect(() => {
    if (!hasEmbeddedPlayer || !animeId || !currentEpisode.number) return;
    setEmbeddedUrl(
      buildEmbeddedPlayerUrl(animeId, currentEpisode.number.toString(), language),
    );
    setEmbeddedServerName(getEmbeddedServerName(language));
  }, [animeId, currentEpisode.number, language, hasEmbeddedPlayer]);

  useEffect(() => {
    let isMounted = true;
    const fetchInfo = async () => {
      if (!animeId) {
        console.error('Anime ID is null.');
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const info = await fetchAnimeData(animeId);
        if (isMounted) {
          setAnimeInfo(info);
        }
      } catch (error) {
        console.error(
          'Failed to fetch anime data, trying fetchAnimeInfo as a fallback:',
          error,
        );
        try {
          const fallbackInfo = await fetchAnimeInfo(animeId);
          if (isMounted) {
            setAnimeInfo(fallbackInfo);
          }
        } catch (fallbackError) {
          console.error(
            'Also failed to fetch anime info as a fallback:',
            fallbackError,
          );
        } finally {
          if (isMounted) setLoading(false);
        }
      }
    };

    fetchInfo();

    return () => {
      isMounted = false;
    };
  }, [animeId]);

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      setLoading(true);
      if (!animeId) return;
      try {
        const isDub = language === 'dub';
        const animeData = await fetchAnimeEpisodes(animeId, 'kickassanime', isDub);
        if (isMounted && animeData) {
          const transformedEpisodes = animeData
            .filter((ep: any) => ep.id)
            .map((ep: any, index: number) => {
              let episodeNumber = String(index + 1);
              let episodeTitle = ep.title || '';
              
              if (ep.id.includes('/episode/')) {
                const episodePart = ep.id.split('/episode/')[1];
                const episodeNumberMatch = episodePart.match(/^ep-(\d+)/);
                if (episodeNumberMatch) {
                  episodeNumber = episodeNumberMatch[1];
                }
              } else if (ep.id.includes('-episode-')) {
                const episodePart = ep.id.split('-episode-')[1];
                const episodeNumberMatch = episodePart.match(/^ep-(\d+)/);
                if (episodeNumberMatch) {
                  episodeNumber = episodeNumberMatch[1];
                }
              }
              
              if (episodeTitle) {
                episodeTitle = episodeTitle.replace(/^\d+-\d+\.\s+/, '');
              }
              
              return {
                ...ep,
                provider: ep.provider || 'kickassanime',
                number: episodeNumber,
                id: ep.id,
                title: episodeTitle || `Episode ${episodeNumber}`,
                image: ep.image,
              };
            });
          setEpisodes(transformedEpisodes);
          const navigateToEpisode = (() => {
            if (languageChanged) {
              const currentEpisodeNumber =
                episodeNumber || String(currentEpisode.number);
              return (
                transformedEpisodes.find(
                  (ep: any) => String(ep.number) === currentEpisodeNumber,
                ) || transformedEpisodes[transformedEpisodes.length - 1]
              );
            } else if (episodeNumber) {
              return (
                transformedEpisodes.find((ep: any) => String(ep.number) === episodeNumber) ||
                transformedEpisodes[0]
              );
            } else {
              const savedEpisodeData = localStorage.getItem(
                LOCAL_STORAGE_KEYS.LAST_WATCHED_EPISODE + animeId,
              );
              const savedEpisode = savedEpisodeData
                ? JSON.parse(savedEpisodeData)
                : null;
              return savedEpisode
                ? transformedEpisodes.find(
                    (ep: any) => String(ep.number) === String(savedEpisode.number),
                  ) || transformedEpisodes[0]
                : transformedEpisodes[0];
            }
          })();

          if (navigateToEpisode && String(navigateToEpisode.number) !== episodeNumber) {
            setCurrentEpisode({
              id: navigateToEpisode.id,
              number: navigateToEpisode.number,
              image: navigateToEpisode.image,
              title: navigateToEpisode.title,
              description: navigateToEpisode.description,
              imageHash: navigateToEpisode.imageHash,
              airDate: navigateToEpisode.airDate,
              provider: navigateToEpisode.provider,
            });

            navigate(
              `/watch/${animeId}?ep=${navigateToEpisode.number}`,
              { replace: true },
            );
            setLanguageChanged(false);
          } else if (navigateToEpisode) {
            setCurrentEpisode({
              id: navigateToEpisode.id,
              number: navigateToEpisode.number,
              image: navigateToEpisode.image,
              title: navigateToEpisode.title,
              description: navigateToEpisode.description,
              imageHash: navigateToEpisode.imageHash,
              airDate: navigateToEpisode.airDate,
              provider: navigateToEpisode.provider,
            });
            setLanguageChanged(false);
          }
        }
      } catch (error) {
        console.error('Failed to fetch episodes:', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    const updateLastVisited = () => {
      if (!animeInfo || !animeId) return;

      const lastVisited = localStorage.getItem(
        LOCAL_STORAGE_KEYS.LAST_ANIME_VISITED,
      );
      const lastVisitedData = lastVisited ? JSON.parse(lastVisited) : {};
      lastVisitedData[animeId] = {
        timestamp: Date.now(),
        titleEnglish: animeInfo.title.english,
        titleRomaji: animeInfo.title.romaji,
      };

      localStorage.setItem(
        LOCAL_STORAGE_KEYS.LAST_ANIME_VISITED,
        JSON.stringify(lastVisitedData),
      );
    };

    if (animeId) {
      updateLastVisited();
    }

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [animeId, episodeNumber, navigate, language, languageChanged]);

  useEffect(() => {
    const updateBackgroundImage = () => {
      const episodeImage = currentEpisode.image;
      const bannerImage = animeInfo?.cover || animeInfo?.artwork[3].img;
      if (episodeImage && episodeImage !== animeInfo.image) {
        const img = new Image();
        img.onload = () => {
          if (img.width > 500) {
            setSelectedBackgroundImage(episodeImage);
          } else {
            setSelectedBackgroundImage(bannerImage);
          }
        };
        img.onerror = () => {
          setSelectedBackgroundImage(bannerImage);
        };
        img.src = episodeImage;
      } else {
        setSelectedBackgroundImage(bannerImage);
      }
    };
    if (animeInfo && currentEpisode.id !== '0') {
      updateBackgroundImage();
    }
  }, [animeInfo, currentEpisode]);

  useEffect(() => {
    updateVideoPlayerWidth();
    const handleResize = () => {
      updateVideoPlayerWidth();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateVideoPlayerWidth]);

  useEffect(() => {
    const updateMaxHeight = () => {
      if (videoPlayerContainerRef.current) {
        const height = videoPlayerContainerRef.current.offsetHeight;
        setMaxEpisodeListHeight(`${height}px`);
      }
    };
    updateMaxHeight();
    window.addEventListener('resize', updateMaxHeight);
    return () => window.removeEventListener('resize', updateMaxHeight);
  }, []);

  // Save server selection per episode (skip empty/loading state)
  useEffect(() => {
    if (animeId && currentEpisode.id && currentEpisode.id !== '0' && sourceType) {
      saveServerForEpisode(animeId, currentEpisode.id, sourceType);
      console.log('Saved server:', sourceType, 'for episode:', currentEpisode.id);
    }
  }, [sourceType, animeId, currentEpisode.id]);

  // When available servers are fetched, auto-select: restore saved server or pick first available
  useEffect(() => {
    if (!hasFetchedServers) return;

    const savedServer = getSavedServerForEpisode(animeId, currentEpisode.id);
    if (
      savedServer &&
      (availableServers.includes(savedServer) || savedServer === 'embedded')
    ) {
      console.log('Restoring saved server:', savedServer);
      setSourceType(savedServer);
    } else if (availableServers.length > 0) {
      console.log('Auto-selecting first available server:', availableServers[0]);
      setSourceType(availableServers[0]);
    } else if (hasEmbeddedPlayer) {
      console.log('Auto-selecting embedded player');
      setSourceType('embedded');
    }
  }, [availableServers, hasEmbeddedPlayer, hasFetchedServers]);

  // Reset everything when the episode changes so stale values never flash.
  // NOTE: embeddedServerName is intentionally NOT reset here — it is derived
  // purely from `language` ("Zen Sub" / "Zen Dub") and must stay visible
  // in the server selector while the new episode's servers are being fetched.
  // Clearing it here would override the effect above (which runs first, being
  // declared earlier) and cause Zen Sub/Dub to vanish until the async fetch
  // completes.
  useEffect(() => {
    if (currentEpisode.id && currentEpisode.id !== '0') {
      setSourceType('');
      setAvailableServers([]);
      setHasFetchedServers(false);
      setServerEntries([]);
      setEmbeddedUrl('');
      setServerUrl('');
      setHlsDirectUrl('');
      setAnimekaiHlsSources([]);
      setAnimekaiSubtitles([]);
      setEmbeddedServerKeys(new Set(['embedded']));
    }
  }, [currentEpisode.id]);

  // Resolve the correct player URL/source whenever the selected server changes.
  // For animekai:
  //   - 'embedded'         → Zen Sub/Dub iframe (restore EMBEDDED_PLAYER_1 URL)
  //   - iframe server name → set embeddedUrl to that server's iframe URL
  //   - HLS server name    → set hlsDirectUrl to the M3U8 URL (HLS player)
  // For kickassanime:
  //   - 'embedded'         → Zen Sub/Dub iframe
  //   - iframe server name → set embeddedUrl to that server's proxied iframe URL
  useEffect(() => {
    if (
      !currentEpisode.id ||
      currentEpisode.id === '0' ||
      !sourceType
    ) {
      return;
    }

    const episodeProvider = currentEpisode.provider || 'kickassanime';
    const isAnimekai = episodeProvider === 'animekai';
    const isKickassanime = episodeProvider === 'kickassanime';

    if (sourceType === 'embedded') {
      // Zen selected — make sure embeddedUrl points to the Zen player URL
      if (hasEmbeddedPlayer) {
        setEmbeddedUrl(
          buildEmbeddedPlayerUrl(animeId, currentEpisode.number.toString(), language),
        );
      }
      setHlsDirectUrl('');
      return;
    }

    // For animekai: check if it's an HLS source or iframe server
    if (isAnimekai) {
      // Check if the selected server is one of the animekai HLS sources
      const hlsSource = animekaiHlsSources.find((s) => s.name === sourceType);
      if (hlsSource) {
        setHlsDirectUrl(hlsSource.url);
        // No embeddedUrl change needed — isEmbedded will be false for this server
        return;
      }

      // Otherwise it's an animekai iframe server (e.g. Megaup Sub/Dub)
      setHlsDirectUrl('');
      if (serverEntries.length === 0) return;

      const normalizedSource = sourceType.toLowerCase();

      // Extract base name and occurrence index from names like "Megaup Sub 1 (2)"
      const indexMatch = normalizedSource.match(/^(.+?)\s*\((\d+)\)$/);
      let baseName = normalizedSource;
      let targetIndex = 1;
      if (indexMatch) {
        baseName = indexMatch[1].trim();
        targetIndex = parseInt(indexMatch[2], 10);
      }

      // Find the nth matching server entry
      let matchCount = 0;
      let matchingServer: (typeof serverEntries)[number] | null = null;
      for (const entry of serverEntries) {
        if (entry.name.toLowerCase() === baseName) {
          matchCount++;
          if (matchCount === targetIndex) {
            matchingServer = entry;
            break;
          }
        }
      }
      // Fallback to first match
      matchingServer =
        matchingServer ||
        serverEntries.find((e) => e.name.toLowerCase() === baseName) ||
        serverEntries[0];

      if (matchingServer?.url) {
        // Override embeddedUrl with this specific server's iframe URL
        setEmbeddedUrl(matchingServer.url);
        setServerUrl(matchingServer.url);
      }
    } else if (isKickassanime) {
      // For kickassanime: both m3u8 and iframe versions may have same display name
      // Iframe versions are marked with "__EM" suffix internally
      if (serverEntries.length === 0) return;

      const isEmbedded = sourceType.endsWith('__EM');
      const baseName = sourceType.replace(/__EM$/, '');

      // Find the matching entry based on name and type
      const selectedEntry = serverEntries.find(
        (s) => {
          const nameMatch = s.name.toLowerCase() === baseName.toLowerCase();
          const typeMatch = isEmbedded ? s.type === 'iframe' : s.type === 'hls';
          return nameMatch && typeMatch;
        }
      );

      if (selectedEntry?.url) {
        if (isEmbedded) {
          // Iframe version
          setEmbeddedUrl(selectedEntry.url);
          setServerUrl(selectedEntry.url);
          setHlsDirectUrl('');
        } else {
          // M3U8 version
          setHlsDirectUrl(selectedEntry.url);
          setEmbeddedUrl('');
          setServerUrl(selectedEntry.url);
        }
      }
    }
  }, [
    currentEpisode.id,
    currentEpisode.provider,
    sourceType,
    serverEntries,
    animekaiHlsSources,
    language,
    hasEmbeddedPlayer,
    animeId,
  ]);

  // Fetch available servers for this episode.
  // For animekai: servers are treated as embedded iframes (no M3U8 loading).
  // For other providers: M3U8 verification (existing behavior).
  useEffect(() => {
    if (!currentEpisode.id || currentEpisode.id === '0') return;

    const fetchAvailableServers = async () => {
      setHasFetchedServers(false);
      console.log('Fetching available servers for episode:', currentEpisode.id);
      try {
        const episodeProvider = currentEpisode.provider || 'kickassanime';
        const response = await fetchAnimeStreamingLinks(currentEpisode.id, episodeProvider);
        console.log('Streaming links response:', response);

        const isAnimekai = episodeProvider === 'animekai';
        const isKickassanime = episodeProvider === 'kickassanime';

        // For animekai: extract iframe servers from API response
        // For kickassanime: create BOTH m3u8 and iframe versions of servers
        let serverEntriesFromResponse: Array<{ name: string; url: string; type: string }> = [];
        
        if (Array.isArray(response?.servers)) {
          const filtered = response.servers.filter((server: any) => {
            if (isAnimekai) {
              // Animekai: filter by language
              return server.type === language;
            }
            return true;
          });

          serverEntriesFromResponse = filtered.flatMap((server: any) => {
            const serverName = server?.name || '';
            const serverUrl = server?.url || '';

            if (!serverName || !serverUrl) return [];

            if (isKickassanime) {
              // For kickassanime: create BOTH m3u8 and iframe versions
              const entries = [
                // Original M3U8 version (no EM badge)
                {
                  name: serverName,
                  url: serverUrl,
                  type: 'hls',
                },
                // Proxied iframe version (will get EM badge in UI)
                {
                  name: serverName,
                  url: buildKickassanimeIframeUrl(serverUrl),
                  type: 'iframe',
                },
              ];
              return entries;
            } else {
              // Animekai: just return as-is
              return [{
                name: serverName,
                url: serverUrl,
                type: server?.type || '',
              }];
            }
          });
        }

        setServerEntries(serverEntriesFromResponse);

        if (hasEmbeddedPlayer) {
          // Always show Zen Sub/Dub when EMBEDDED_PLAYER_1 is configured, regardless of provider.
          setEmbeddedUrl(
            buildEmbeddedPlayerUrl(animeId, currentEpisode.number.toString(), language),
          );
          setEmbeddedServerName(getEmbeddedServerName(language));
        }

        let servers: string[] = [];

        if (isAnimekai && serverEntriesFromResponse.length > 0) {
          // For animekai: show iframe servers only, because M3U8 sources are unreliable.
          // Prefer the API-provided availableServers list, which preserves sub/dub labels.
          const availableAnimekaiServers = Array.isArray(response?.availableServers)
            ? response.availableServers
            : [];

          const iframeServerKeys = availableAnimekaiServers.length
            ? availableAnimekaiServers
            : serverEntriesFromResponse.map((s: any) => s.name);

          // Do not expose animekai M3U8/HLS sources in the UI; they are not always reliable.
          setAnimekaiHlsSources([]);
          setAnimekaiSubtitles([]);

          // Iframe servers are embedded; HLS servers are not
          setEmbeddedServerKeys(new Set(['embedded', ...iframeServerKeys]));

          servers = [...iframeServerKeys];
          console.log('Animekai servers (iframe EM only):', servers);
        } else if (isKickassanime && serverEntriesFromResponse.length > 0) {
          // For kickassanime: show BOTH m3u8 and iframe (EM) versions with same display name
          // Internal tracking uses suffixes, but they're hidden from display
          const kickassanimeServers = serverEntriesFromResponse.map((s: any) => 
            s.type === 'iframe' ? `${s.name}__EM` : s.name
          );
          
          // Mark only the iframe versions as embedded
          const iframeServerKeys = kickassanimeServers.filter((name: string) => name.endsWith('__EM'));
          setEmbeddedServerKeys(new Set(['embedded', ...iframeServerKeys]));
          
          servers = [...kickassanimeServers];
          console.log('Kickassanime servers (both M3U8 and EM):', servers);
        } else if (response?.availableServers?.length > 0) {
          // For kickassanime: expose the available m3u8 server names directly.
          // These are the real provider names like vidstreamz, catstream, etc.
          servers = response.availableServers;
        } else if (response?.sources?.length > 0) {
          // If the API returned sources but did not list servers, fall back
          // to the synthetic 'direct' option so the player still tries to load.
          servers = ['direct'];
        } else if (serverEntriesFromResponse.length > 0) {
          // Fallback: provider has server entries but no sources/availableServers list.
          // Use 'direct' so the HLS player attempts a default fetch.
          servers = ['direct'];
        }

        console.log('Available servers:', servers);
        setAvailableServers(servers);
      } catch (error) {
        console.error('Error fetching available servers:', error);
        setAvailableServers([]);
      } finally {
        setHasFetchedServers(true);
      }
    };

    fetchAvailableServers();
  }, [currentEpisode.id, animeId, language]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const targetTagName = (event.target as HTMLElement).tagName.toLowerCase();
      if (targetTagName === 'input' || targetTagName === 'textarea') {
        return;
      }
      if (!event.shiftKey || !['N', 'P'].includes(event.key.toUpperCase()))
        return;
      const now = Date.now();
      if (now - lastKeypressTime < 200) return;
      setLastKeypressTime(now);
      const currentIndex = episodes.findIndex(
        (ep) => String(ep.id) === String(currentEpisode.id),
      );
      if (
        event.key.toUpperCase() === 'N' &&
        currentIndex < episodes.length - 1
      ) {
        const nextEpisode = episodes[currentIndex + 1];
        handleEpisodeSelect(nextEpisode);
      } else if (event.key.toUpperCase() === 'P' && currentIndex > 0) {
        const prevEpisode = episodes[currentIndex - 1];
        handleEpisodeSelect(prevEpisode);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [episodes, currentEpisode, handleEpisodeSelect, lastKeypressTime]);

  useEffect(() => {
    if (animeInfo && animeInfo.title) {
      document.title =
        'Watch ' +
        (animeInfo.title.english ||
          animeInfo.title.romaji ||
          animeInfo.title.romaji ||
          '') +
        ' | Zenime';
    }
  }, [animeInfo]);

  useEffect(() => {
    let isMounted = true;
    const fetchInfo = async () => {
      if (!animeId) {
        console.error('Anime ID is undefined.');
        return;
      }
      try {
        const info = await fetchAnimeData(animeId);
        if (isMounted) {
          setAnimeInfo(info);
        }
      } catch (error) {
        console.error('Failed to fetch anime info:', error);
      }
    };
    fetchInfo();
    return () => {
      isMounted = false;
    };
  }, [animeId]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (!episodes || episodes.length === 0) {
        setShowNoEpisodesMessage(true);
      }
    }, 10000);
    return () => clearTimeout(timeoutId);
  }, [loading, episodes]);

  useEffect(() => {
    if (!loading && episodes.length === 0) {
      setShowNoEpisodesMessage(true);
    } else {
      setShowNoEpisodesMessage(false);
    }
  }, [loading, episodes]);

  return (
    <WatchContainer>
      {animeInfo &&
      animeInfo.status === 'Not yet aired' &&
      animeInfo.trailer ? (
        <div style={{ textAlign: 'center' }}>
          <strong>
            <h2>Time Remaining:</h2>
          </strong>
          {animeInfo &&
          animeInfo.nextAiringEpisode &&
          countdown !== 'Airing now or aired' ? (
            <p>
              <FaBell /> {countdown}
            </p>
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
            <img src={Image404URL} alt='404 Error'></img>
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
                    animeTitle={
                      animeInfo?.title?.english || animeInfo?.title?.romaji
                    }
                    sourceType={sourceType}
                    embeddedUrl={embeddedUrl}
                    serverUrl={serverUrl}
                    embeddedServerKeys={embeddedServerKeys}
                    hlsDirectUrl={hlsDirectUrl}
                    externalSubtitles={
                      currentEpisode.provider === 'animekai'
                        ? animekaiSubtitles
                        : undefined
                    }
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
                      const episode = episodes.find((e) => e.id === episodeId);
                      if (episode) {
                        handleEpisodeSelect(episode);
                      }
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
              airingTime={
                animeInfo && animeInfo.status === 'Ongoing'
                  ? countdown
                  : undefined
              }
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