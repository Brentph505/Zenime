import React, { useEffect, useRef, useState } from 'react';
import './PlayerStyles.css';
import { useNavigate } from 'react-router-dom';
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
  sourceType = '',
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
  const navigate = useNavigate();


  // --- Fix for stale closure ---
  const onEpisodeEndRef = useRef(onEpisodeEnd);
  const autoNextRef = useRef(autoNext);
  useEffect(() => {
    onEpisodeEndRef.current = onEpisodeEnd;
    autoNextRef.current = autoNext;
  }, [onEpisodeEnd, autoNext]);

  const isEmbedded = sourceType === 'embedded';

  // Build the embedded URL, injecting autoplay=1 when the user has autoplay on
  const builtEmbeddedUrl = React.useMemo(() => {
    if (!embeddedUrl) return '';
    try {
      const u = new URL(embeddedUrl);
      if (autoPlay) u.searchParams.set('autoplay', '1');
      return u.toString();
    } catch {
      return embeddedUrl;
    }
  }, [embeddedUrl, autoPlay]);

  useEffect(() => {
    console.log('[Player] sourceType changed:', sourceType, '| isEmbedded:', isEmbedded);
  }, [sourceType]);

  // Listen for postMessage events from the cross-origin iframe.
  // Most embeddable players (vidstack, plyr, jwplayer, custom) broadcast an
  // 'ended' signal so we can trigger auto-next without direct DOM access.
  useEffect(() => {
    if (!isEmbedded) return;

    const handleMessage = (event: MessageEvent) => {
      const d = event.data;
      if (!d) return;

      const isEnded =
        d === 'ended' ||
        d?.type === 'ended' ||
        d?.event === 'ended' ||
        d?.action === 'ended' ||
        d?.type === 'video:ended' ||
        d?.name === 'ended' ||
        (typeof d === 'string' && d.toLowerCase().includes('ended'));

      if (isEnded) {
        console.log('[Player] iframe postMessage: video ended');
        if (autoNextRef.current) handlePlaybackEndedRef.current();
      }
    };

    // Use a ref for handlePlaybackEnded to avoid stale closure
    const handlePlaybackEndedRef = {
      current: async () => {
        if (!autoNextRef.current) return;
        try {
          player.current?.pause();
          await new Promise((resolve) => setTimeout(resolve, 200));
          await onEpisodeEndRef.current();
        } catch (error) {
          console.error('Error moving to the next episode:', error);
        }
      },
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isEmbedded]);

  // When switching TO embedded mode, clear the HLS src so MediaPlayer unmounts cleanly
  useEffect(() => {
    if (isEmbedded) {
      setSrc('');
    }
  }, [isEmbedded]);

  useEffect(() => {
    // Skip fetching if episodeId is not valid
    if (!episodeId || episodeId === '0') return;
    // Skip HLS fetch entirely when in embedded mode — the iframe handles playback
    if (isEmbedded) return;

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
      const playbackInfo = { currentTime, playbackPercentage };
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
        if (skipInterval && player.current) {
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

      if (previousEndTime < startTime) {
        vttString += `${formatTime(previousEndTime)} --> ${formatTime(startTime)}\n`;
        vttString += `${animeVideoTitle} - Episode ${episodeNumber}\n\n`;
      }

      vttString += `${formatTime(startTime)} --> ${formatTime(endTime)}\n`;
      vttString += `${skipType}\n\n`;
      previousEndTime = endTime;

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
      const serverParam = sourceType && sourceType !== 'default'
        ? sourceType.toLowerCase()
        : undefined;

      console.log('[Player] fetchAndSetAnimeSource:', { episodeId, sourceType, serverParam });

      const response: StreamingResponse = await fetchAnimeStreamingLinksProxied(
        episodeId,
        'kickassanime',
        serverParam,
      );

      if (response.sources && response.sources.length > 0) {
        const m3u8Sources = response.sources.filter(
          (source) => source.isM3U8 || source.url?.endsWith('.m3u8'),
        );

        if (m3u8Sources.length > 0) {
          setSrc(m3u8Sources[0].url);
          console.log('[Player] Set src:', m3u8Sources[0].url);
        } else {
          console.error('No M3U8 sources found');
        }

        if (response.download) {
          updateDownloadLink(response.download);
        }
      } else {
        console.error('No video sources in response');
      }

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
    const epMatch = id.match(/ep[-_]?(\d+)/i);
    if (epMatch) return epMatch[1];
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
    if (!autoNextRef.current) return;
    try {
      player.current?.pause();
      await new Promise((resolve) => setTimeout(resolve, 200));
      await onEpisodeEndRef.current();
    } catch (error) {
      console.error('Error moving to the next episode:', error);
    }
  };

  return (
    <div style={{ animation: 'popIn 0.25s ease-in-out' }}>
      {/* Embedded iframe player — key forces full remount when URL changes */}
      {isEmbedded && builtEmbeddedUrl && (
        <div style={{ position: 'relative' }}>
          <div
            key={builtEmbeddedUrl}
            style={{ width: '100%', aspectRatio: '16/9' }}
          >
            <iframe
              src={builtEmbeddedUrl}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                borderRadius: 'var(--global-border-radius)',
              }}
              allowFullScreen
              allow="autoplay; fullscreen; picture-in-picture"
              title={`${animeVideoTitle} - Episode ${episodeNumber}`}
            />
          </div>
          {/* Controls overlay — mirrors the HLS player-menu for the iframe */}
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
      )}

      {/* HLS video player — only shown when NOT in embedded mode */}
      {!isEmbedded && (
        <>
        <MediaPlayer
          className='player'
          title={`${animeVideoTitle} - Episode ${episodeNumber}`}
          src={src}
          autoplay={autoPlay}
          muted={false}
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
            <Poster 
              className='vds-poster' 
              src={banner} 
              alt='' 
              onClick={() => animeId && navigate(`/info/${animeId}`)}
              style={{ cursor: 'pointer' }}
            />
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
        </>
      )}
    </div>
  );
}