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
  const getSourceTypeKey = (animeId: string | undefined) =>
    `source-[${animeId}]`;
  const getLanguageKey = (animeId: string | undefined) =>
    `subOrDub-[${animeId}]`;
  
  // Per-episode server storage keys
  const getEpisodeServerKey = (animeId: string | undefined, episodeId: string | undefined) =>
    `episode-server-[${animeId}]-[${episodeId}]`;
  
  const getSavedServerForEpisode = (animeId: string | undefined, episodeId: string | undefined) => {
    if (!animeId || !episodeId) return 'default';
    return localStorage.getItem(getEpisodeServerKey(animeId, episodeId)) || 'default';
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
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [currentEpisode, setCurrentEpisode] = useState<Episode>({
    id: '0',
    number: 1,
    title: '',
    image: '',
    description: '',
    imageHash: '',
    airDate: '',
  });
  const [animeInfo, setAnimeInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showNoEpisodesMessage, setShowNoEpisodesMessage] = useState(false);
  const [lastKeypressTime, setLastKeypressTime] = useState(0);
  const [sourceType, setSourceType] = useState<string>('default');
  const [language, setLanguage] = useState(
    () => localStorage.getItem(STORAGE_KEYS.LANGUAGE) || 'sub',
  );
  const [downloadLink, setDownloadLink] = useState('');
  const [availableServers, setAvailableServers] = useState<string[]>([]);
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
    async (selectedEpisode: Episode) => {
      setCurrentEpisode({
        id: selectedEpisode.id,
        number: selectedEpisode.number,
        image: selectedEpisode.image,
        title: selectedEpisode.title,
        description: selectedEpisode.description,
        imageHash: selectedEpisode.imageHash,
        airDate: selectedEpisode.airDate,
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
    const defaultSourceType = 'default';
    const defaultLanguage = 'sub';
    setSourceType(
      localStorage.getItem(getSourceTypeKey(animeId || '')) ||
        defaultSourceType,
    );
    setLanguage(
      localStorage.getItem(getLanguageKey(animeId || '')) || defaultLanguage,
    );
  }, [animeId]);

  useEffect(() => {
    localStorage.setItem(getLanguageKey(animeId), language);
  }, [language, animeId]);

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
            });

            navigate(
              `/watch/${animeId}?ep=${navigateToEpisode.number}`,
              { replace: true },
            );
            setLanguageChanged(false);
          } else if (navigateToEpisode) {
            // Just update currentEpisode without navigating if URL already matches
            setCurrentEpisode({
              id: navigateToEpisode.id,
              number: navigateToEpisode.number,
              image: navigateToEpisode.image,
              title: navigateToEpisode.title,
              description: navigateToEpisode.description,
              imageHash: navigateToEpisode.imageHash,
              airDate: navigateToEpisode.airDate,
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

  useEffect(() => {
    // Save server selection per episode
    if (animeId && currentEpisode.id && currentEpisode.id !== '0') {
      saveServerForEpisode(animeId, currentEpisode.id, sourceType);
      console.log('Saved server:', sourceType, 'for episode:', currentEpisode.id);
    }
  }, [sourceType, animeId, currentEpisode.id]);

  useEffect(() => {
    // Load saved server for the current episode, or default if new episode
    if (animeId && currentEpisode.id && currentEpisode.id !== '0') {
      const savedServer = getSavedServerForEpisode(animeId, currentEpisode.id);
      console.log('Loading saved server for episode:', currentEpisode.id, '->', savedServer);
      setSourceType(savedServer);
    } else {
      setSourceType('default');
    }
  }, [currentEpisode.id, animeId]);

  useEffect(() => {
    if (!currentEpisode.id || currentEpisode.id === '0') return;

    const fetchAvailableServers = async () => {
      console.log('Fetching available servers for episode:', currentEpisode.id);
      try {
        const response = await fetchAnimeStreamingLinks(currentEpisode.id, 'kickassanime');
        console.log('Streaming links response:', response);
        console.log('Response keys:', Object.keys(response));
        console.log('availableServers:', response?.availableServers);
        console.log('servers:', response?.servers);
        
        // Try to get availableServers from response
        let servers: string[] = [];
        
        if (response && response.availableServers && Array.isArray(response.availableServers) && response.availableServers.length > 0) {
          console.log('Found availableServers in response');
          servers = response.availableServers.map((s: string) => s.toLowerCase());
        } else if (response && response.servers && Array.isArray(response.servers) && response.servers.length > 0) {
          console.log('Found servers in response');
          // Extract server names from servers array
          servers = response.servers
            .map((s: any) => {
              if (typeof s === 'string') return s.toLowerCase();
              if (s.name) return s.name.toLowerCase();
              return null;
            })
            .filter(Boolean) as string[];
        } else {
          console.log('No servers found in response, using known servers');
          // Only use known servers as fallback if API returns nothing
          servers = ['vidstreaming', 'duckstream', 'birdstream'];
        }
        
        // Remove duplicates
        servers = [...new Set(servers)];
        
        // Always include 'default' as an option
        if (!servers.includes('default')) {
          servers.unshift('default');
        }
        
        // Verify each server has valid M3U8 sources before showing
        const verifiedServers: string[] = [];
        for (const server of servers) {
          try {
            const serverResponse = await fetchAnimeStreamingLinks(
              currentEpisode.id,
              'kickassanime',
              server === 'default' ? undefined : server
            );
            // Check if server has valid M3U8 sources
            const hasM3U8 = serverResponse.sources?.some(
              (s: any) => s.isM3U8 || s.url?.endsWith('.m3u8')
            );
            if (hasM3U8) {
              verifiedServers.push(server);
              console.log(`Server ${server} has valid M3U8 sources`);
            } else {
              console.log(`Server ${server} has no M3U8 sources, hiding`);
            }
          } catch (e) {
            console.log(`Server ${server} check failed, hiding`);
          }
        }
        
        // Fallback to default if no servers verified
        const finalServers = verifiedServers.length > 0 ? verifiedServers : ['default'];
        console.log('Final servers list (verified):', finalServers);
        setAvailableServers(finalServers);
      } catch (error) {
        console.error('Error fetching available servers:', error);
        setAvailableServers(['default']);
      }
    };

    fetchAvailableServers();
  }, [currentEpisode.id, animeId]);

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
                    malId={animeInfo?.malId}
                    banner={selectedBackgroundImage}
                    updateDownloadLink={updateDownloadLink}
                    onEpisodeEnd={handleEpisodeEnd}
                    onPrevEpisode={onPrevEpisode}
                    onNextEpisode={onNextEpisode}
                    animeTitle={
                      animeInfo?.title?.english || animeInfo?.title?.romaji
                    }
                    sourceType={sourceType}
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