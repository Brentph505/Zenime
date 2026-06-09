import { useEffect, useRef, useState } from 'react';
import './PlayerStyles.css';
import { useNavigate } from 'react-router-dom';
import {
  isHLSProvider,
  MediaPlayer,
  MediaProvider,
  Poster,
  Track,
  type MediaErrorDetail,
  type MediaErrorEvent,
  type MediaProviderAdapter,
  type MediaProviderChangeEvent,
  type MediaPlayerInstance,
  type PlayerSrc,
  formatTime,
} from '@vidstack/react';
import styled from 'styled-components';
import {
  fetchSkipTimes,
  fetchAnimeStreamingLinksProxied,
  useSettings,
} from '../../../index';
import { useAuth } from '../../../client/useAuth';
import { saveWatchProgress, getAniListIdFromMalId } from '../../../client/authService';
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

const EmbeddedPlayerWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;

  .player-menu {
    position: static !important;
    width: 100%;
    z-index: 1;
  }
`;

const EmbeddedIframeWrapper = styled.div`
  width: 100%;
  aspect-ratio: 16 / 9;
  min-height: 12rem;
  background-color: black;
  overflow: hidden;
`;

const EmbeddedIframe = styled.iframe`
  width: 100%;
  height: 100%;
  display: block;
  border: none;
  border-radius: var(--global-border-radius);
  background-color: black;
  transform: translateZ(0);
  backface-visibility: hidden;
`;

type PlayerProps = {
  episodeId: string;
  episodeNumber?: number;
  episodeProvider?: string;
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
  /** Set of server keys that should render as iframes (includes 'embedded' servers) */
  embeddedServerKeys?: Set<string>;
  /** Direct M3U8 URL to use for HLS servers (bypasses API fetch) */
  hlsDirectUrl?: string;
  /** Subtitles to inject when using hlsDirectUrl (animekai HLS playback) */
  externalSubtitles?: Array<{ url: string; lang: string }>;
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

const getEpisodeNumber = (episodeId: string): string => {
  const match = episodeId.match(/(\d+)$/);
  return match ? match[1] : '1';
};

export function Player({
  episodeId,
  episodeNumber: propEpisodeNumber,
  episodeProvider = 'kickassanime',
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
  embeddedServerKeys,
  hlsDirectUrl,
  externalSubtitles,
}: PlayerProps) {
  const { isLoggedIn } = useAuth();
  const player = useRef<MediaPlayerInstance>(null);
  const [src, setSrc] = useState<PlayerSrc>('');
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [vttUrl, setVttUrl] = useState<string>('');
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [skipTimes, setSkipTimes] = useState<SkipTime[]>([]);
  const [totalDuration, setTotalDuration] = useState<number>(0);
  const [vttGenerated, setVttGenerated] = useState<boolean>(false);
  const [canPlay, setCanPlay] = useState<boolean>(false);
  const [userInteracted, setUserInteracted] = useState<boolean>(false);
  const [builtEmbeddedUrl, setBuiltEmbeddedUrl] = useState<string>('');

  // Incrementing token — any in-flight fetchAndSetAnimeSource whose token doesn't
  // match the current value is considered stale and must not call setSrc.
  const fetchAbortRef = useRef<number>(0);

  const hlsUrlCandidatesRef = useRef<string[]>([]);
  const currentHlsUrlIndexRef = useRef<number>(0);
  const hlsRetryCountRef = useRef<number>(0);
  const retryTimerRef = useRef<number | null>(null);
  const aniListProgressRef = useRef({ lastSavedProgress: 0, lastSavedTime: 0 });
  const iframeProgressRef = useRef({ currentTime: 0, duration: 0, hasTriggeredEnd: false });
  const saveAniListProgressRef = useRef<((episodeNumber: number) => Promise<void>) | null>(null);
  const episodeNumber = propEpisodeNumber
    ? String(propEpisodeNumber)
    : getEpisodeNumber(episodeId);

  useEffect(() => {
    aniListProgressRef.current = { lastSavedProgress: 0, lastSavedTime: 0 };
    iframeProgressRef.current = { currentTime: 0, duration: 0, hasTriggeredEnd: false };
  }, [episodeNumber]);

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

  // Determine whether to show the iframe player or the HLS player.
  const isEmbedded = embeddedServerKeys
    ? embeddedServerKeys.has(sourceType)
    : sourceType === 'embedded';

  // Detect ReAnime's flixcloud.cc player specifically.
  const isFlixcloudEmbed = isEmbedded && Boolean(embeddedUrl?.includes('flixcloud.cc'));
  const animePaheIframeProxy = (import.meta.env.VITE_EMBEDDED_PROXY_ANIMEPAHE as string) || '';

  const shouldProxyAnimePaheEmbeddedUrl = (url: string) => {
    if (!animePaheIframeProxy) return false;
    try {
      const parsed = new URL(url);
      return parsed.hostname.includes('kwik') || parsed.hostname.includes('animepahe');
    } catch {
      return false;
    }
  };

  // A stable key for the iframe that changes only when the episode/server changes.
  const stableIframeKey = `${episodeId}-${sourceType}-${embeddedUrl || ''}`;

  useEffect(() => {
    if (!embeddedUrl) {
      setBuiltEmbeddedUrl('');
      return;
    }

    try {
      const u = new URL(embeddedUrl);
      const isFlixcloud = u.hostname.includes('flixcloud.cc');

      if (isFlixcloud) {
        u.searchParams.set('autoPlay', autoPlay ? 'true' : 'false');
        u.searchParams.set('skI', autoSkip ? 'true' : 'false');
        u.searchParams.set('skO', autoSkip ? 'true' : 'false');
      } else {
        if (autoPlay) {
          u.searchParams.set('autoplay', '1');
        } else {
          u.searchParams.delete('autoplay');
        }
      }

      const proxiedUrl = shouldProxyAnimePaheEmbeddedUrl(u.toString())
        ? `${animePaheIframeProxy.replace(/\/+$/, '')}/?url=${encodeURIComponent(u.toString())}`
        : u.toString();

      setBuiltEmbeddedUrl(proxiedUrl);
    } catch (err) {
      console.warn('[Player] Failed to build embedded URL:', err, 'original:', embeddedUrl);
      setBuiltEmbeddedUrl(embeddedUrl);
    }
  }, [embeddedUrl, autoPlay, autoSkip, animePaheIframeProxy]);

  useEffect(() => {
    if (isEmbedded && isFlixcloudEmbed) {
      console.log('[Player] ReAnime/flixcloud not working');
    }
  }, [isEmbedded, isFlixcloudEmbed]);

  // ─── iframe postMessage event bridge ────────────────────────────────────────
  useEffect(() => {
    if (!isEmbedded) return;

    const handlePlaybackEndedRef = {
      current: async () => {
        if (!autoNextRef.current) return;
        try {
          player.current?.pause();
          await new Promise((resolve) => setTimeout(resolve, 200));
          await onEpisodeEndRef.current();
        } catch (err) {
          console.error('[Player] auto-next error:', err);
        }
      },
    };

    const saveIframeProgress = (currentTime: number, duration: number) => {
      if (!episodeId || duration <= 0) return;
      const playbackPercentage = (currentTime / duration) * 100;
      iframeProgressRef.current = {
        currentTime,
        duration,
        hasTriggeredEnd: iframeProgressRef.current.hasTriggeredEnd,
      };

      try {
        const all = JSON.parse(localStorage.getItem('all_episode_times') || '{}');
        all[episodeId] = { currentTime, playbackPercentage };
        localStorage.setItem('all_episode_times', JSON.stringify(all));
      } catch {
        // localStorage unavailable — ignore
      }

      if (settings.aniListSync && isLoggedIn && malId && propEpisodeNumber) {
        const now = Date.now();
        const minProgress = Math.min(aniListProgressRef.current.lastSavedProgress + 15, 99);
        if (
          playbackPercentage >= minProgress &&
          now - aniListProgressRef.current.lastSavedTime >= 60_000
        ) {
          aniListProgressRef.current.lastSavedProgress = playbackPercentage;
          aniListProgressRef.current.lastSavedTime = now;
          void saveAniListProgressRef.current?.(propEpisodeNumber);
        }
      }

      // ── ReAnime/flixcloud: time-based autoNext detection ──────────────────
      if (isFlixcloudEmbed && duration > 0) {
        const remainingTime = duration - currentTime;
        const pct = (currentTime / duration) * 100;
        if (
          !iframeProgressRef.current.hasTriggeredEnd &&
          (remainingTime < 2 || pct > 99)
        ) {
          iframeProgressRef.current.hasTriggeredEnd = true;
          if (autoNextRef.current) handlePlaybackEndedRef.current();
        }
      }
    };

    const saveIframeProgressOnUnload = () => {
      const { currentTime, duration } = iframeProgressRef.current;
      if (duration > 0) saveIframeProgress(currentTime, duration);
    };

    const handleMessage = (event: MessageEvent) => {
      let data = event.data;
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch {
          return;
        }
      }
      if (!data || typeof data !== 'object') return;

      const normalized = {
        ...data,
        source: String(data.source || '').toLowerCase(),
        type: String(data.type || '').toLowerCase(),
        event: String(data.event || '').toLowerCase(),
        query: String(data.query || '').toLowerCase(),
        action: String(data.action || '').toLowerCase(),
        name: String(data.name || '').toLowerCase(),
        currentTime:
          typeof data.currentTime === 'number'
            ? data.currentTime
            : typeof data.currentTime === 'string' && data.currentTime.trim() !== ''
            ? Number(data.currentTime)
            : undefined,
        duration:
          typeof data.duration === 'number'
            ? data.duration
            : typeof data.duration === 'string' && data.duration.trim() !== ''
            ? Number(data.duration)
            : undefined,
      } as typeof data & {
        source: string;
        type: string;
        event: string;
        query: string;
        action: string;
        name: string;
        currentTime?: number;
        duration?: number;
      };

      // ── MegaCloud channel ──────────────────────────────────────────────────
      if (normalized.channel === 'megacloud') {
        switch (normalized.event) {
          case 'complete':
            if (autoNextRef.current) handlePlaybackEndedRef.current();
            break;
          case 'time':
            if (
              typeof normalized.time === 'number' &&
              typeof normalized.duration === 'number'
            ) {
              saveIframeProgress(normalized.time, normalized.duration);
            }
            break;
          default:
            break;
        }
        return;
      }

      // ── watching-log (MegaPlay / HiAnime style) ───────────────────────────
      if (normalized.type === 'watching-log') {
        if (
          typeof normalized.currentTime === 'number' &&
          typeof normalized.duration === 'number'
        ) {
          saveIframeProgress(normalized.currentTime, normalized.duration);
        }
        return;
      }

      // ── ArtPlayer (flixcloud / ReAnime) ───────────────────────────────────
      if (normalized.source === 'artplayer') {
        const artEnded =
          normalized.query === 'ended' ||
          normalized.type === 'ended' ||
          normalized.event === 'ended' ||
          normalized.type === 'video:ended';
        if (artEnded) {
          console.log('[Player] ArtPlayer (flixcloud/ReAnime): video ended');
          if (autoNextRef.current) handlePlaybackEndedRef.current();
          return;
        }
        if (
          typeof normalized.currentTime === 'number' &&
          typeof normalized.duration === 'number'
        ) {
          saveIframeProgress(normalized.currentTime, normalized.duration);
        }
        return;
      }

      // ── Flixcloud direct channel ──────────────────────────────────────────
      if (normalized.channel === 'flixcloud' || normalized.source === 'flixcloud') {
        const fcEnded =
          normalized.event === 'ended' ||
          normalized.event === 'complete' ||
          normalized.type === 'ended';
        if (fcEnded) {
          if (autoNextRef.current) handlePlaybackEndedRef.current();
          return;
        }
        if (
          typeof normalized.currentTime === 'number' &&
          typeof normalized.duration === 'number'
        ) {
          saveIframeProgress(normalized.currentTime, normalized.duration);
        }
        return;
      }

      // ── Generic player progress fallback ───────────────────────────────────
      if (
        typeof normalized.currentTime === 'number' &&
        typeof normalized.duration === 'number'
      ) {
        saveIframeProgress(normalized.currentTime, normalized.duration);
      }

      // ── Generic ended fallback ────────────────────────────────────────────
      const isEnded =
        data === 'ended' ||
        normalized.event === 'ended' ||
        normalized.type === 'ended' ||
        normalized.type === 'video:ended' ||
        normalized.query === 'ended' ||
        normalized.action === 'ended' ||
        normalized.name === 'ended';

      if (isEnded) {
        if (autoNextRef.current) handlePlaybackEndedRef.current();
      }
    };

    window.addEventListener('message', handleMessage);
    window.addEventListener('pagehide', saveIframeProgressOnUnload);
    window.addEventListener('beforeunload', saveIframeProgressOnUnload);

    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('pagehide', saveIframeProgressOnUnload);
      window.removeEventListener('beforeunload', saveIframeProgressOnUnload);
    };
  }, [isEmbedded, episodeId, settings, isLoggedIn, malId, propEpisodeNumber]);

  const prevIsEmbeddedRef = useRef<boolean>(isEmbedded);

  useEffect(() => {
    if (isEmbedded) {
      setSrc('');
    } else if (prevIsEmbeddedRef.current && !isEmbedded) {
      resetHlsRetryState();
      setSrc('');
      setSubtitles([]);
    }
    prevIsEmbeddedRef.current = isEmbedded;
  }, [isEmbedded]);

  useEffect(() => {
    if (!episodeId || episodeId === '0') return;
    if (isEmbedded) return;

    // Cancel any previous in-flight fetch
    fetchAbortRef.current += 1;

    setCurrentTime(parseFloat(localStorage.getItem('currentTime') || '0'));
    setSrc('');
    fetchAndSetAnimeSource();
    fetchAndProcessSkipTimes();

    return () => {
      // Cancel fetch on cleanup
      fetchAbortRef.current += 1;
      if (vttUrl) URL.revokeObjectURL(vttUrl);
    };
  }, [episodeId, malId, updateDownloadLink, sourceType, serverUrl, hlsDirectUrl]);

  useEffect(() => {
    return () => {
      if (retryTimerRef.current) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, []);

  const clearHlsRetryTimer = () => {
    if (retryTimerRef.current) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  };

  const resetHlsRetryState = () => {
    hlsRetryCountRef.current = 0;
    currentHlsUrlIndexRef.current = 0;
    clearHlsRetryTimer();
  };

  const getCurrentHlsUrl = () =>
    hlsUrlCandidatesRef.current[currentHlsUrlIndexRef.current];

  const scheduleHlsRetry = (message: string) => {
    const currentUrl = getCurrentHlsUrl();
    if (!currentUrl) return;

    const nextCandidateIndex = currentHlsUrlIndexRef.current + 1;
    const hasNextCandidate = nextCandidateIndex < hlsUrlCandidatesRef.current.length;
    const maxRetries = 2;
    const retryDelay = 2500;

    clearHlsRetryTimer();

    if (hasNextCandidate) {
      console.warn('[Player] HLS source failed, switching to next candidate:', currentUrl);
      retryTimerRef.current = window.setTimeout(() => {
        currentHlsUrlIndexRef.current = nextCandidateIndex;
        const nextUrl = getCurrentHlsUrl();
        if (nextUrl) {
          setSrc({ src: nextUrl, type: 'application/vnd.apple.mpegurl' });
          console.log('[Player] HLS retry: next candidate:', nextUrl);
        }
      }, retryDelay);
      return;
    }

    if (hlsRetryCountRef.current < maxRetries) {
      hlsRetryCountRef.current += 1;
      console.warn(
        '[Player] HLS source failed, retrying same URL:',
        currentUrl,
        'attempt',
        hlsRetryCountRef.current,
        'message:',
        message,
      );
      retryTimerRef.current = window.setTimeout(() => {
        setSrc({ src: currentUrl, type: 'application/vnd.apple.mpegurl' });
      }, retryDelay);
    } else {
      console.error('[Player] HLS source failed after retries:', currentUrl, 'message:', message);
      clearHlsRetryTimer();
    }
  };

  const onMediaError = (detail: MediaErrorDetail, nativeEvent: MediaErrorEvent) => {
    const message =
      detail.message ||
      detail.error?.message ||
      detail.mediaError?.message ||
      'Unknown HLS error';

    console.error('[Player] HLS media error:', message, nativeEvent);

    if (!hlsUrlCandidatesRef.current.length) return;

    const shouldRetry = /403|network|failed|error/i.test(message);
    if (!shouldRetry) return;

    scheduleHlsRetry(message);
  };

  useEffect(() => {
    if (autoPlay && userInteracted && canPlay && player.current) {
      player.current
        .play()
        .catch((e) => console.log('Playback failed to start automatically:', e));
    }
  }, [autoPlay, src, canPlay, userInteracted]);

  useEffect(() => {
    const handleUserInteraction = () => {
      if (!userInteracted) setUserInteracted(true);
    };

    window.addEventListener('mousedown', handleUserInteraction);
    window.addEventListener('touchstart', handleUserInteraction);
    window.addEventListener('keydown', handleUserInteraction);

    return () => {
      window.removeEventListener('mousedown', handleUserInteraction);
      window.removeEventListener('touchstart', handleUserInteraction);
      window.removeEventListener('keydown', handleUserInteraction);
    };
  }, [userInteracted]);

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
      localStorage.setItem('all_episode_times', JSON.stringify(allPlaybackInfo));

      if (settings.aniListSync && isLoggedIn && malId && propEpisodeNumber) {
        const now = Date.now();
        const minProgress = Math.min(
          aniListProgressRef.current.lastSavedProgress + 15,
          99,
        );
        if (
          playbackPercentage >= minProgress &&
          now - aniListProgressRef.current.lastSavedTime >= 60_000
        ) {
          aniListProgressRef.current.lastSavedProgress = playbackPercentage;
          aniListProgressRef.current.lastSavedTime = now;
          void saveAniListProgressRef.current?.(propEpisodeNumber);
        }
      }

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
    // Capture the current token; if it changes while we await, the fetch is stale.
    const fetchToken = fetchAbortRef.current;

    const isValidHlsDirectUrl =
      hlsDirectUrl &&
      (/\.m3u8$/i.test(hlsDirectUrl) || /\/manifest\//i.test(hlsDirectUrl) || /\.mp4/i.test(hlsDirectUrl));

    if (isValidHlsDirectUrl) {
      if (fetchToken !== fetchAbortRef.current) return;
      resetHlsRetryState();
      hlsUrlCandidatesRef.current = [hlsDirectUrl];
      const type = /\.mp4/i.test(hlsDirectUrl) ? 'video/mp4' : 'application/vnd.apple.mpegurl';
      setSrc({ src: hlsDirectUrl, type });
      console.log('[Player] Using direct media url:', hlsDirectUrl);
      if (externalSubtitles && externalSubtitles.length > 0) {
        setSubtitles(externalSubtitles);
      }
      return;
    }

    if (hlsDirectUrl && !isValidHlsDirectUrl) {
      console.warn(
        '[Player] Ignoring invalid hlsDirectUrl and falling back to proxied fetch:',
        hlsDirectUrl,
      );
    }

    // 'direct' is a synthetic KAA server key meaning "use the default API fetch".
    const serverParam =
      sourceType && sourceType !== 'default' && sourceType !== 'direct'
        ? sourceType.toLowerCase()
        : undefined;

    console.log('[Player] fetchAndSetAnimeSource:', {
      episodeId,
      sourceType,
      serverParam,
      serverUrl,
    });

    // Special handling for Megaplay servers
    if (sourceType?.startsWith('megaplay') && serverUrl) {
      console.log('[Megaplay] Fetching from:', serverUrl);
      try {
        const response = await fetch(serverUrl);
        if (fetchToken !== fetchAbortRef.current) return; // stale
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        if (fetchToken !== fetchAbortRef.current) return; // stale

        console.log('[Megaplay] Response:', data);

        if (data.sources && data.sources.length > 0) {
          const m3u8Sources = data.sources.filter(
            (source: any) => source.isM3U8 || source.url?.endsWith('.m3u8'),
          );

          if (m3u8Sources.length > 0) {
            resetHlsRetryState();
            hlsUrlCandidatesRef.current = m3u8Sources.map((source: any) => source.url);
            setSrc({
              src: m3u8Sources[0].url,
              type: 'application/vnd.apple.mpegurl',
            });
            console.log('[Megaplay] Set HLS src:', m3u8Sources[0].url);
          } else {
            console.error('[Megaplay] No M3U8 sources found');
            hlsUrlCandidatesRef.current = [];
          }

          if (data.download) {
            updateDownloadLink(data.download);
          }
        }

        if (data.subtitles?.length) {
          setSubtitles(data.subtitles);
        }
      } catch (megaplayError) {
        console.error('[Megaplay] Failed to fetch:', megaplayError);
      }
      return;
    }

    try {
      const response: StreamingResponse = await fetchAnimeStreamingLinksProxied(
        episodeId,
        episodeProvider || 'kickassanime',
        serverParam,
        serverUrl,
      );

      // Discard result if a newer fetch has been started
      if (fetchToken !== fetchAbortRef.current) return;

      if (response.sources && response.sources.length > 0) {
        const isDubServer = sourceType?.toLowerCase().includes('dub')
          ? true
          : sourceType?.toLowerCase().includes('sub')
          ? false
          : undefined;

        const candidateSources = response.sources.filter(
          (source: StreamingSource & { isDub?: boolean }) =>
            (source.isM3U8 || source.url?.endsWith('.m3u8')) &&
            (isDubServer === undefined || source.isDub === isDubServer),
        );
        const m3u8Sources =
          candidateSources.length > 0
            ? candidateSources
            : response.sources.filter(
                (source) => source.isM3U8 || source.url?.endsWith('.m3u8'),
              );

        if (m3u8Sources.length > 0) {
          resetHlsRetryState();
          hlsUrlCandidatesRef.current = m3u8Sources.map((source) => source.url);
          setSrc({
            src: m3u8Sources[0].url,
            type: 'application/vnd.apple.mpegurl',
          });
          console.log('[Player] Set HLS src:', m3u8Sources[0].url);
        } else {
          console.error('No M3U8 sources found');
          hlsUrlCandidatesRef.current = [];
        }

        if (response.download) {
          updateDownloadLink(response.download);
        }
      } else {
        console.error('No video sources in response');
      }

      if (response.subtitles?.length) {
        setSubtitles(response.subtitles);
      }
    } catch (error) {
      console.error('Failed to fetch anime streaming links', error);
    }
  }

  const saveAniListProgress = async (episodeNumber: number) => {
    const accessToken =
      typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

    if (!isLoggedIn || !accessToken || !malId || !settings.aniListSync) return;

    try {
      const malIdNum = parseInt(malId);
      if (isNaN(malIdNum)) return;

      const aniListId = await getAniListIdFromMalId(malIdNum);
      if (!aniListId) {
        console.warn('⚠️ [AniList] Could not find AniList ID for MAL ID:', malId);
        return;
      }

      await saveWatchProgress(accessToken, aniListId, episodeNumber);
      console.log('✅ [AniList] Progress saved for episode', episodeNumber);
    } catch (error) {
      console.error('❌ [AniList] Failed to save progress:', error);
    }
  };

  useEffect(() => {
    saveAniListProgressRef.current = saveAniListProgress;
  }, [saveAniListProgress]);

  const toggleAutoPlay = () => setSettings({ ...settings, autoPlay: !autoPlay });
  const toggleAutoNext = () => setSettings({ ...settings, autoNext: !autoNext });
  const toggleAutoSkip = () => setSettings({ ...settings, autoSkip: !autoSkip });

  const handlePlaybackEnded = async () => {
    if (!autoNextRef.current) return;
    try {
      player.current?.pause();
      await new Promise((resolve) => setTimeout(resolve, 200));

      if (propEpisodeNumber) {
        await saveAniListProgress(propEpisodeNumber);
      }

      await onEpisodeEndRef.current();
    } catch (error) {
      console.error('Error moving to the next episode:', error);
    }
  };

  return (
    <div style={{ animation: 'popIn 0.25s ease-in-out' }}>
      {/* Embedded iframe player — key forces full remount when URL changes */}
      {isEmbedded && builtEmbeddedUrl && (
        <EmbeddedPlayerWrapper>
          <EmbeddedIframeWrapper key={stableIframeKey}>
            <EmbeddedIframe
              src={builtEmbeddedUrl}
              allowFullScreen
              allow="accelerometer; gyroscope; magnetometer; autoplay; fullscreen; picture-in-picture; screen-wake-lock"
              title={`${animeVideoTitle || 'Anime'} - Episode ${episodeNumber}`}
            />
          </EmbeddedIframeWrapper>
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
            {isFlixcloudEmbed && (
              <Button $autoskip onClick={toggleAutoSkip}>
                {autoSkip ? <FaCheck /> : <RiCheckboxBlankFill />} Auto Skip
              </Button>
            )}
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
        </EmbeddedPlayerWrapper>
      )}

      {/* HLS video player — only shown when NOT in embedded mode */}
      {!isEmbedded && (
        <>
          <MediaPlayer
            key={`player-${episodeId}-${sourceType}-${hlsDirectUrl || serverUrl}`}
            className='player'
            title={`${animeVideoTitle || 'Anime'} - Episode ${episodeNumber}`}
            src={src}
            autoplay={autoPlay && userInteracted}
            muted={false}
            crossorigin
            playsinline
            onLoadedMetadata={onLoadedMetadata}
            onCanPlay={onCanPlay}
            onError={onMediaError}
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