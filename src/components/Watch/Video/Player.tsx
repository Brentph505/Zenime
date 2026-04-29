import { useEffect, useRef, useState } from 'react';
import './PlayerStyles.css';
import {
  isHLSProvider,
  MediaPlayer,
  MediaProvider,
  Poster,
  Track,
  type MediaProviderAdapter,
  type MediaProviderChangeEvent,
  type MediaPlayerInstance,
} from '@vidstack/react';
import styled from 'styled-components';
import {
  fetchSkipTimes,
  fetchAnimeStreamingLinksProxied,
  useSettings,
} from '../../../index';
import {
  DefaultAudioLayout,
  defaultLayoutIcons,
  DefaultVideoLayout,
} from '@vidstack/react/player/layouts/default';
import { TbPlayerTrackPrev, TbPlayerTrackNext } from 'react-icons/tb';
import { FaCheck } from 'react-icons/fa6';
import { RiCheckboxBlankFill } from 'react-icons/ri';

const Button = styled.button<{ $autoskip?: boolean }>`
  padding: 0.25rem;
  font-size: 0.8rem;
  border: none;
  margin-right: 0.25rem;
  border-radius: var(--global-border-radius);
  cursor: pointer;
  background-color: var(--global-div);
  color: var(--global-text);
  svg {
    margin-bottom: -0.1rem;
    color: grey;
  }
  @media (max-width: 500px) {
    font-size: 0.7rem;
  }

  &.active {
    background-color: var(--primary-accent);
  }
  ${({ $autoskip }) =>
    $autoskip &&
    `
    color: #d69e00; 
    svg {
      color: #d69e00; 
    }
  `}
`;

type PlayerProps = {
  episodeId: string;
  episodeNumber?: number;
  banner?: string;
  malId?: string;
  animeId?: string;
  updateDownloadLink: (link: string) => void;
  onEpisodeEnd: () => Promise<void>;
  onPrevEpisode: () => void;
  onNextEpisode: () => void;
  animeTitle?: string;
  sourceType?: string;
  embeddedUrl?: string;
  serverUrl?: string;
};

type StreamingSource = {
  url: string;
  quality: string;
  isM3U8?: boolean;
};

type Subtitle = {
  url: string;
  lang: string;
};

type StreamingResponse = {
  sources: StreamingSource[];
  subtitles?: Subtitle[];
  availableServers?: string[];
  download?: string;
  headers?: Record<string, string>;
};

type SkipTime = {
  interval: {
    startTime: number;
    endTime: number;
  };
  skipType: string;
};

type FetchSkipTimesResponse = {
  results: SkipTime[];
};

export function Player({
  episodeId,
  episodeNumber: propEpisodeNumber,
  banner,
  malId,
  animeId,
  updateDownloadLink,
  onEpisodeEnd,
  onPrevEpisode,
  onNextEpisode,
  animeTitle,
  sourceType = 'default',
  embeddedUrl,
  serverUrl,
}: PlayerProps) {
  const player = useRef<MediaPlayerInstance>(null);
  const [src, setSrc] = useState<string>('');
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [vttUrl, setVttUrl] = useState<string>('');
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [skipTimes, setSkipTimes] = useState<SkipTime[]>([]);
  const [totalDuration, setTotalDuration] = useState<number>(0);
  const [vttGenerated, setVttGenerated] = useState<boolean>(false);
  const [canPlay, setCanPlay] = useState<boolean>(false);
  const episodeNumber = propEpisodeNumber
    ? String(propEpisodeNumber)
    : getEpisodeNumber(episodeId);
  const animeVideoTitle = animeTitle;

  const { settings, setSettings } = useSettings();
  const { autoPlay, autoNext, autoSkip } = settings;

  // Debug: log sourceType changes
  useEffect(() => {
    console.log('[Player] sourceType changed:', sourceType);
  }, [sourceType]);

  useEffect(() => {
    // Skip fetching if episodeId is not valid
    if (!episodeId || episodeId === '0') {
      return;
    }

    setCurrentTime(parseFloat(localStorage.getItem('currentTime') || '0'));

    fetchAndSetAnimeSource();
    fetchAndProcessSkipTimes();
    return () => {
      if (vttUrl) URL.revokeObjectURL(vttUrl);
    };
  }, [episodeId, malId, updateDownloadLink, sourceType]);

  useEffect(() => {
    if (autoPlay && canPlay && player.current) {
      player.current
        .play()
        .catch((e) =>
          console.log('Playback failed to start automatically:', e),
        );
    }
  }, [autoPlay, src, canPlay]);

  // Force player to reload when src changes (server change)
  useEffect(() => {
    if (player.current && src) {
      console.log('[Player] Source changed, reloading player:', src);
      // Note: Vidstack player reloads automatically when src changes
      // No manual load() method needed on MediaPlayerInstance
    }
  }, [src]);

  useEffect(() => {
    if (player.current && currentTime) {
      player.current.currentTime = currentTime;
    }
  }, [currentTime]);

  function onProviderChange(
    provider: MediaProviderAdapter | null,
    _nativeEvent: MediaProviderChangeEvent,
  ) {
    if (isHLSProvider(provider)) {
      provider.config = {};
    }
  }

  function onLoadedMetadata() {
    if (player.current) {
      setTotalDuration(player.current.duration);
    }
  }

  function onCanPlay() {
    setCanPlay(true);
  }

  function onTimeUpdate() {
    if (player.current) {
      const currentTime = player.current.currentTime;
      const duration = player.current.duration || 1;
      const playbackPercentage = (currentTime / duration) * 100;
      const playbackInfo = {
        currentTime,
        playbackPercentage,
      };
      const allPlaybackInfo = JSON.parse(
        localStorage.getItem('all_episode_times') || '{}',
      );
      allPlaybackInfo[episodeId] = playbackInfo;
      localStorage.setItem(
        'all_episode_times',
        JSON.stringify(allPlaybackInfo),
      );

      if (autoSkip && skipTimes.length) {
        const skipInterval = skipTimes.find(
          ({ interval }) =>
            currentTime >= interval.startTime && currentTime < interval.endTime,
        );
        if (skipInterval) {
          player.current.currentTime = skipInterval.interval.endTime;
        }
      }
    }
  }

  function generateWebVTTFromSkipTimes(
    skipTimes: FetchSkipTimesResponse,
    totalDuration: number,
  ): string {
    let vttString = 'WEBVTT\n\n';
    let previousEndTime = 0;

    const sortedSkipTimes = skipTimes.results.sort(
      (a, b) => a.interval.startTime - b.interval.startTime,
    );

    sortedSkipTimes.forEach((skipTime, index) => {
      const { startTime, endTime } = skipTime.interval;
      const skipType =
        skipTime.skipType.toUpperCase() === 'OP' ? 'Opening' : 'Outro';

      // Insert default title chapter before this skip time if there's a gap
      if (previousEndTime < startTime) {
        vttString += `${formatTime(previousEndTime)} --> ${formatTime(startTime)}\n`;
        vttString += `${animeVideoTitle} - Episode ${episodeNumber}\n\n`;
      }

      // Insert this skip time
      vttString += `${formatTime(startTime)} --> ${formatTime(endTime)}\n`;
      vttString += `${skipType}\n\n`;
      previousEndTime = endTime;

      // Insert default title chapter after the last skip time
      if (index === sortedSkipTimes.length - 1 && endTime < totalDuration) {
        vttString += `${formatTime(endTime)} --> ${formatTime(totalDuration)}\n`;
        vttString += `${animeVideoTitle} - Episode ${episodeNumber}\n\n`;
      }
    });

    return vttString;
  }

  async function fetchAndProcessSkipTimes() {
    if (malId && episodeId) {
      const episodeNumber = getEpisodeNumber(episodeId);
      try {
        const response: FetchSkipTimesResponse = await fetchSkipTimes({
          malId: malId.toString(),
          episodeNumber,
        });
        const filteredSkipTimes = response.results.filter(
          ({ skipType }) => skipType === 'op' || skipType === 'ed',
        );
        if (!vttGenerated) {
          const vttContent = generateWebVTTFromSkipTimes(
            { results: filteredSkipTimes },
            totalDuration,
          );
          const blob = new Blob([vttContent], { type: 'text/vtt' });
          const vttBlobUrl = URL.createObjectURL(blob);
          setVttUrl(vttBlobUrl);
          setSkipTimes(filteredSkipTimes);
          setVttGenerated(true);
        }
      } catch (error) {
        console.error('Failed to fetch skip times', error);
      }
    }
  }

  async function fetchAndSetAnimeSource() {
    try {
      // Use server parameter only if sourceType is not 'default'
      // Convert to lowercase to match API expected format
      const serverParam =
        sourceType !== 'default' ? sourceType.toLowerCase() : undefined;
      console.log('[Player] fetchAndSetAnimeSource called with:', {
        episodeId,
        sourceType,
        serverParam,
      });

      // Server URL will be automatically extracted from API response
      const response: StreamingResponse = await fetchAnimeStreamingLinksProxied(
        episodeId,
        'kickassanime',
        serverParam,
      );
      console.log('[Player] API response:', response);
      console.log('[Player] API response sources:', response?.sources);
      console.log(
        '[Player] API response sources length:',
        response?.sources?.length,
      );

      if (response.sources && response.sources.length > 0) {
        // Filter to only include M3U8 sources - check both isM3U8 flag and URL extension
        const m3u8Sources = response.sources.filter(
          (source) => source.isM3U8 || source.url?.endsWith('.m3u8'),
        );
        console.log('[Player] M3U8 sources:', m3u8Sources);

        if (m3u8Sources.length > 0) {
          // Get the first/best quality M3U8 source
          const selectedSource = m3u8Sources[0];
          console.log('[Player] Selected source URL:', selectedSource.url);
          setSrc(selectedSource.url);
        } else {
          console.error('No M3U8 video sources found in response');
        }

        // Set download link if available
        if (response.download) {
          updateDownloadLink(response.download);
        }
      } else {
        console.error('No video sources found in response');
      }

      // Set subtitles if available
      if (response.subtitles && response.subtitles.length > 0) {
        setSubtitles(response.subtitles);
      }
    } catch (error) {
      console.error('Failed to fetch anime streaming links', error);
    }
  }

  function formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  function getEpisodeNumber(id: string): string {
    // Handle episode IDs like: that-time-i-got-reincarnated-as-a-slime-season-3-6b04/episode/ep-1-9ff869
    // Extract the episode number from patterns like "ep-1" or "episode-1"
    const epMatch = id.match(/ep[-_]?(\d+)/i);
    if (epMatch) {
      return epMatch[1];
    }
    // Fallback: try to get the last numeric part
    const parts = id.split(/[-/]/);
    const lastPart = parts[parts.length - 1];
    const num = parseInt(lastPart, 10);
    return isNaN(num) ? '1' : num.toString();
  }

  const toggleAutoPlay = () =>
    setSettings({ ...settings, autoPlay: !autoPlay });
  const toggleAutoNext = () =>
    setSettings({ ...settings, autoNext: !autoNext });
  const toggleAutoSkip = () =>
    setSettings({ ...settings, autoSkip: !autoSkip });

  const handlePlaybackEnded = async () => {
    if (!autoNext) return;

    try {
      player.current?.pause();

      await new Promise((resolve) => setTimeout(resolve, 200)); // Delay for transition
      await onEpisodeEnd();
    } catch (error) {
      console.error('Error moving to the next episode:', error);
    }
  };

  return (
    <div style={{ animation: 'popIn 0.25s ease-in-out' }}>
      {/* Embedded iframe player */}
      {embeddedUrl && (
        <div style={{ width: '100%', aspectRatio: '16/9' }}>
          <iframe
            src={embeddedUrl}
            style={{ width: '100%', height: '100%', border: 'none' }}
            allowFullScreen
            allow="autoplay; fullscreen"
            title={`${animeVideoTitle} - Episode ${episodeNumber}`}
          />
        </div>
      )}

      {/* Regular video player */}
      {!embeddedUrl && (
      <MediaPlayer
        className='player'
        title={`${animeVideoTitle} - Episode ${episodeNumber}`}
        src={src}
        autoplay={autoPlay}
        muted={false} // Player should never be muted by default
        crossorigin
        playsinline
        onLoadedMetadata={onLoadedMetadata}
        onCanPlay={onCanPlay}
        onProviderChange={onProviderChange}
        onTimeUpdate={onTimeUpdate}
        ref={player}
        aspectRatio='16/9'
        load='eager'
        posterLoad='eager'
        streamType='on-demand'
        storage='storage-key'
        keyTarget='player'
        onEnded={handlePlaybackEnded}
      >
        <MediaProvider>
          <Poster className='vds-poster' src={banner} alt='' />
          {vttUrl && (
            <Track kind='chapters' src={vttUrl} default label='Skip Times' />
          )}
          {subtitles &&
            subtitles.length > 0 &&
            subtitles.map((subtitle, index) => (
              <Track
                key={`subtitle-${index}`}
                kind='subtitles'
                src={subtitle.url}
                label={subtitle.lang}
                default={subtitle.lang === 'English' || index === 0}
              />
            ))}
        </MediaProvider>
        <DefaultAudioLayout icons={defaultLayoutIcons} />
        <DefaultVideoLayout icons={defaultLayoutIcons} />
      </MediaPlayer>
      )}
      <div
        className='player-menu'
        style={{
          backgroundColor: 'var(--global-div-tr)',
          borderRadius: 'var(--global-border-radius)',
        }}
      >
        <Button onClick={toggleAutoPlay}>
          {autoPlay ? <FaCheck /> : <RiCheckboxBlankFill />} Autoplay
        </Button>
        <Button $autoskip onClick={toggleAutoSkip}>
          {autoSkip ? <FaCheck /> : <RiCheckboxBlankFill />} Auto Skip
        </Button>
        <Button onClick={onPrevEpisode}>
          <TbPlayerTrackPrev /> Prev
        </Button>
        <Button onClick={onNextEpisode}>
          <TbPlayerTrackNext /> Next
        </Button>
        <Button onClick={toggleAutoNext}>
          {autoNext ? <FaCheck /> : <RiCheckboxBlankFill />} Auto Next
        </Button>
      </div>
    </div>
  );
}
