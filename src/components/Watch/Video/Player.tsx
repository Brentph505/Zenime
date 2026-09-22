import { useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import './PlayerStyles.css';
import { useNavigate } from 'react-router-dom';
import {
  isHLSProvider,
  MediaPlayer,
  MediaProvider,
  Menu,
  Poster,
  Track,
  TimeSlider,
  type MediaErrorDetail,
  type MediaErrorEvent,
  type MediaProviderAdapter,
  type MediaProviderChangeEvent,
  type MediaPlayerInstance,
  type PlayerSrc,
  formatTime,
} from '@vidstack/react';
import styled, { keyframes } from 'styled-components';
import {
  fetchSkipTimes,
  fetchAnimeStreamingLinksProxied,
  useSettings,
  isDirectMediaUrl,
} from '../../../index';
import { useAuth } from '../../../client/useAuth';
import { syncWatchProgress, getAniListIdFromMalId } from '../../../client/authService';
import {
  DefaultAudioLayout,
  DefaultMenuButton,
  DefaultMenuRadioGroup,
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

const PlayerViewport = styled.div`
  width: 100%;
  aspect-ratio: 16 / 9;
  min-height: 12rem;
  position: relative;
  overflow: hidden;
  background-color: black;
  border-radius: var(--global-border-radius);

  > .player,
  > iframe {
    width: 100%;
    height: 100%;
  }
`;

const skipButtonFill = keyframes`
  from { background-position: 100% 0; }
  to { background-position: 0 0; }
`;

const skipButtonSlideLeft = keyframes`
  from { transform: translateX(10px); }
  to { transform: translateX(0); }
`;

const SkipSegmentButton = styled.button`
  position: absolute;
  left: 1rem;
  bottom: 4.5rem;
  z-index: 2;
  border: 1px solid #fff;
  border-radius: 0.45rem;
  padding: 0.6rem 1rem;
  background: linear-gradient(270deg, rgba(255, 255, 255, 0.5) 50%, rgba(255, 255, 255, 0.7) 50%) 100% 0 / 200% 100%;
  backdrop-filter: blur(10px);
  color: #333;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  animation:
    ${skipButtonFill} 8s cubic-bezier(0.25, 1, 0.25, 1) forwards,
    ${skipButtonSlideLeft} 0.4s ease-in-out;
  transition: opacity 0.2s ease-out;

  &:hover,
  &:focus-visible {
    background: #fff;
    color: #000;
  }

  &:active {
    transform: scale(0.95);
  }

  @media (max-width: 600px) {
    left: 0.6rem;
    bottom: 3.5rem;
    padding: 0.45rem 0.65rem;
    font-size: 0.75rem;
  }
`;

const ChapterTimeSlider = () => (
  <TimeSlider.Root className='vds-time-slider vds-slider' aria-label='Seek'>
    <TimeSlider.Chapters className='vds-slider-chapters'>
      {(cues, forwardRef) =>
        cues.map((cue) => {
          const cueLabel = cue.text.toLowerCase();
          const chapterClass = cueLabel.includes('opening')
            ? 'zenime-chapter-opening'
            : cueLabel.includes('outro') || cueLabel.includes('ending')
              ? 'zenime-chapter-ending'
              : undefined;

          return (
            <div
              key={cue.startTime}
              ref={forwardRef}
              className={`vds-slider-chapter ${chapterClass || ''}`}
            >
              <TimeSlider.Track className='vds-slider-track'>
                <TimeSlider.TrackFill className='vds-slider-track-fill vds-slider-track' />
                <TimeSlider.Progress className='vds-slider-progress vds-slider-track' />
              </TimeSlider.Track>
            </div>
          );
        })
      }
    </TimeSlider.Chapters>
    <TimeSlider.Thumb className='vds-slider-thumb' />
    <TimeSlider.Preview className='vds-slider-preview'>
      <TimeSlider.ChapterTitle className='vds-slider-chapter-title' />
      <TimeSlider.Value className='vds-slider-value' />
    </TimeSlider.Preview>
  </TimeSlider.Root>
);

type PlayerProps = {
  episodeId: string;
  episodeNumber?: number;
  episodeProvider?: string;
  banner?: string;
  malId?: string;
  animeId?: string;
  /** Total episodes for the series — enables auto-complete on the final episode. */
  totalEpisodes?: number;
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
  /** Genres of the anime, used to determine Hentai/NSFW for sync guards */
  animeGenres?: string[];
  /** Whether the anime is marked as adult content by AniList */
  animeIsAdult?: boolean;
};

type StreamingSource = {
  url: string;
  quality: string;
  isM3U8?: boolean;
  isDub?: boolean;
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

// ─── Dub/Sub detection helper ────────────────────────────────────────────────
// Some providers (e.g. AniDB) don't populate `source.isDub` at all — they only
// give a human-readable `quality` string like "English Dub" / "Japanese Sub".
// Relying on `source.isDub === true/false` alone means that field is always
// `undefined` for those providers, so the strict equality check never matches
// and every source falls through as a "candidate", after which we just grab
// sources[0] — which happened to always be the Dub track for AniDB. This
// helper falls back to reading the quality/name text when isDub is missing.
const sourceIsDub = (source: StreamingSource): boolean | undefined => {
  if (typeof source.isDub === 'boolean') return source.isDub;
  const text = (source.quality || '').toLowerCase();
  if (text.includes('dub')) return true;
  if (text.includes('sub') || text.includes('japanese')) return false;
  return undefined;
};

const isHlsSource = (source: StreamingSource): boolean =>
  Boolean(
    source.isM3U8 ||
      /\.m3u8(\?|$|#)/i.test(source.url) ||
      /\/m3u8(\?|$|#)/i.test(source.url),
  );

const captionWeightOptions = [
  { label: 'Bold', value: '700' },
];

const DEFAULT_CAPTION_FONT_WEIGHT = '700';
const DEFAULT_CAPTION_OUTLINE_WIDTH = 1;
const DEFAULT_CAPTION_PREFERENCES: Record<string, string> = {
  'vds-player:font-size': '125%',
  'vds-player:font-family': 'pro-sans',
  'vds-player:text-color': '#ffffff',
  'vds-player:text-opacity': '100%',
  'vds-player:text-shadow': 'none',
  'vds-player:text-bg': '#000000',
  'vds-player:text-bg-opacity': '100%',
  'vds-player:display-bg': '#000000',
  'vds-player:display-bg-opacity': '0%',
};

const ensureCaptionPreferences = () => {
  Object.entries(DEFAULT_CAPTION_PREFERENCES).forEach(([key, value]) => {
    if (localStorage.getItem(key) === null) {
      localStorage.setItem(key, value);
    }
  });
  if (localStorage.getItem('zenime-caption-font-weight') === null) {
    localStorage.setItem('zenime-caption-font-weight', DEFAULT_CAPTION_FONT_WEIGHT);
  }
};

const getStoredCaptionFontWeight = (): string => {
  const storedWeight = localStorage.getItem('zenime-caption-font-weight');
  return storedWeight === DEFAULT_CAPTION_FONT_WEIGHT
    ? storedWeight
    : DEFAULT_CAPTION_FONT_WEIGHT;
};

const createCaptionTextShadow = (outlineWidth: number): string => {
  if (outlineWidth <= 0) return 'none';

  const shadows: string[] = [];
  for (let x = -outlineWidth; x <= outlineWidth; x += 1) {
    for (let y = -outlineWidth; y <= outlineWidth; y += 1) {
      if (x !== 0 || y !== 0) shadows.push(`${x}px ${y}px 0 #000`);
    }
  }
  return shadows.join(', ');
};

type CaptionStyleExtensionsProps = {
  player: RefObject<MediaPlayerInstance | null>;
  fontWeight: string;
  onFontWeightChange: (value: string) => void;
};

const CaptionStyleExtensions = ({
  player,
  fontWeight,
  onFontWeightChange,
}: CaptionStyleExtensionsProps) => {
  const [captionStylesMenu, setCaptionStylesMenu] = useState<HTMLElement | null>(null);

  useEffect(() => {
    ensureCaptionPreferences();

    const playerElement = player.current?.el;
    if (!playerElement) return;

    const findCaptionStylesMenu = () => {
      const menu = playerElement.querySelector<HTMLElement>('.vds-font-style-items');
      if (menu) setCaptionStylesMenu(menu);
    };

    findCaptionStylesMenu();
    const observer = new MutationObserver(findCaptionStylesMenu);
    observer.observe(playerElement, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
    };
  }, [player, fontWeight]);

  if (!captionStylesMenu) return null;

  return createPortal(
    <Menu.Root className='vds-zenime-caption-menu vds-menu'>
      <DefaultMenuButton label='Zenime' />
      <Menu.Items className='vds-menu-items'>
        <Menu.Root className='vds-font-weight-menu vds-menu'>
          <DefaultMenuButton
            label='Weight'
            hint={
              captionWeightOptions.find((option) => option.value === fontWeight)?.label ||
              'Black'
            }
          />
          <Menu.Items className='vds-menu-items'>
            <DefaultMenuRadioGroup
              value={fontWeight}
              options={captionWeightOptions}
              onChange={onFontWeightChange}
            />
          </Menu.Items>
        </Menu.Root>
      </Menu.Items>
    </Menu.Root>,
    captionStylesMenu,
  );
};

export function Player({
  episodeId,
  episodeNumber: propEpisodeNumber,
  episodeProvider = 'kickassanime',
  banner,
  malId,
  animeId,
  totalEpisodes,
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
  animeGenres = [],
  animeIsAdult = false,
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
  const [captionFontWeight, setCaptionFontWeight] = useState(getStoredCaptionFontWeight);
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
  const playbackTransitionRef = useRef(false);
  const playbackTransitionLockUntilRef = useRef(0);
  const autoplayAttemptKeyRef = useRef('');
  const episodeNumber = propEpisodeNumber
    ? String(propEpisodeNumber)
    : getEpisodeNumber(episodeId);

  useEffect(() => {
    aniListProgressRef.current = { lastSavedProgress: 0, lastSavedTime: 0 };
    iframeProgressRef.current = { currentTime: 0, duration: 0, hasTriggeredEnd: false };
    playbackTransitionRef.current = false;
    playbackTransitionLockUntilRef.current = 0;
    autoplayAttemptKeyRef.current = '';
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

  // ReAnime is the only provider whose FlixCloud iframe gets this bridge.
  const isFlixcloudEmbed =
    isEmbedded &&
    episodeProvider === 'reanime' &&
    Boolean(embeddedUrl?.includes('flixcloud.cc'));
  const isReanimeEmbed = isEmbedded && episodeProvider === 'reanime';
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

  // ─── iframe postMessage event bridge ────────────────────────────────────────
  useEffect(() => {
    if (!isEmbedded) return;

    const handlePlaybackEndedRef = {
      current: async () => {
        if (
          playbackTransitionRef.current ||
          Date.now() < playbackTransitionLockUntilRef.current
        ) {
          return;
        }

        playbackTransitionRef.current = true;
        playbackTransitionLockUntilRef.current = Date.now() + 2_000;

        try {
          if (propEpisodeNumber) {
            await saveAniListProgressRef.current?.(propEpisodeNumber);
          }
          if (!autoNextRef.current) return;
          player.current?.pause();
          await new Promise((resolve) => setTimeout(resolve, 200));
          await onEpisodeEndRef.current();
        } catch (err) {
          console.error('[Player] auto-next error:', err);
        } finally {
          window.setTimeout(() => {
            playbackTransitionRef.current = false;
            playbackTransitionLockUntilRef.current = 0;
          }, 2_200);
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

      if (settings.aniListSync && isLoggedIn && animeId && propEpisodeNumber) {
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
          void handlePlaybackEndedRef.current();
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
        if (isReanimeEmbed && data.trim().toLowerCase() === 'ended') {
          void handlePlaybackEndedRef.current();
          return;
        }
        try {
          data = JSON.parse(data);
        } catch {
          return;
        }
      }
      if (!data || typeof data !== 'object') return;

      // Some ArtPlayer bridges wrap the event in `detail` or `data`.
      // Flatten that envelope before applying the provider-specific checks.
      if (data.detail && typeof data.detail === 'object') data = data.detail;
      if (data.data && typeof data.data === 'object') data = data.data;

      const normalized = {
        ...data,
        source: String(data.source || '').toLowerCase(),
        type: String(data.type || '').toLowerCase(),
        event: String(data.event || '').toLowerCase(),
        query: String(data.query || '').toLowerCase(),
        action: String(data.action || '').toLowerCase(),
        name: String(data.name || '').toLowerCase(),
        playerStatus: String(data.playerStatus || '').toLowerCase(),
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
        playerStatus: string;
        currentTime?: number;
        duration?: number;
      };

      // FlixCloud's ArtPlayer bridge reports completion as
      // { playerStatus: 'Ended' } rather than an `ended` event payload.
      if (isReanimeEmbed && normalized.playerStatus === 'ended') {
        void handlePlaybackEndedRef.current();
        return;
      }

      // ── MegaCloud channel ──────────────────────────────────────────────────
      if (normalized.channel === 'megacloud') {
        switch (normalized.event) {
          case 'complete':
            void handlePlaybackEndedRef.current();
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
          void handlePlaybackEndedRef.current();
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
          void handlePlaybackEndedRef.current();
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
        void handlePlaybackEndedRef.current();
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
  }, [isEmbedded, isReanimeEmbed, episodeId, settings, isLoggedIn, animeId, propEpisodeNumber]);

  const prevIsEmbeddedRef = useRef<boolean>(isEmbedded);

  useEffect(() => {
    if (isEmbedded) {
      setSrc('');
      setSubtitles([]);
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
    setSubtitles([]);
    setSkipTimes([]);
    setVttUrl('');
    setVttGenerated(false);
    fetchAndSetAnimeSource();
    fetchAndProcessSkipTimes();

    return () => {
      // Cancel fetch on cleanup
      fetchAbortRef.current += 1;
      if (vttUrl) URL.revokeObjectURL(vttUrl);
    };
  }, [episodeId, malId, updateDownloadLink, sourceType, serverUrl, hlsDirectUrl]);

  useEffect(() => {
    if (!episodeId || !malId || totalDuration <= 0 || vttGenerated) return;
    fetchAndProcessSkipTimes();
  }, [episodeId, malId, totalDuration, vttGenerated]);

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

  const getCurrentSrcKey = () => {
    if (typeof src === 'string') return src;
    if (src && typeof src === 'object' && 'src' in src) return src.src;
    return '';
  };

  const tryAutoPlay = () => {
    if (isEmbedded || !autoPlay || !userInteracted || !canPlay || !player.current) return;

    const srcKey = getCurrentSrcKey();
    if (!srcKey) return;

    const autoplayKey = `${episodeId}-${srcKey}`;
    if (autoplayAttemptKeyRef.current === autoplayKey) return;

    autoplayAttemptKeyRef.current = autoplayKey;
    player.current
      .play()
      .catch((e) => console.log('Playback failed to start automatically:', e));
  };

  useEffect(() => {
    tryAutoPlay();
  }, [autoPlay, src, canPlay, userInteracted, episodeId]);

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
    applyCaptionStyles();
  }

  function onCanPlay() {
    setCanPlay(true);
    applyCaptionStyles();
    tryAutoPlay();
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

      if (settings.aniListSync && isLoggedIn && animeId && propEpisodeNumber) {
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

  function onSeeked() {
    if (player.current) {
      setCurrentTime(player.current.currentTime);
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
        skipTime.skipType.toUpperCase() === 'OP' ? 'Intro' : 'Outro';

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
        setSkipTimes(filteredSkipTimes);
        if (!vttGenerated && totalDuration > 0) {
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

    // Treat any hlsDirectUrl containing .m3u8 as valid too — isDirectMediaUrl
    // is trusted first, but we don't want an overly strict implementation of
    // that helper to silently kick a perfectly good AniDB HLS URL into the
    // buggy fallback-fetch path below.
    const isValidHlsDirectUrl =
      hlsDirectUrl &&
      (isDirectMediaUrl(hlsDirectUrl) ||
        /\.mp4/i.test(hlsDirectUrl) ||
        /\.m3u8/i.test(hlsDirectUrl) ||
        /\/m3u8(?:\?|$|#)/i.test(hlsDirectUrl));

    if (isValidHlsDirectUrl) {
      if (fetchToken !== fetchAbortRef.current) return;
      resetHlsRetryState();
      hlsUrlCandidatesRef.current = [hlsDirectUrl];
      const type = /\.mp4/i.test(hlsDirectUrl) ? 'video/mp4' : 'application/vnd.apple.mpegurl';
      setSrc({ src: hlsDirectUrl, type });
      console.log('[Player] Using direct media url:', hlsDirectUrl);

      // If the parent already supplied proxied subtitles, use them directly.
      if (externalSubtitles && externalSubtitles.length > 0) {
        setSubtitles(externalSubtitles);
        return;
      }

      // Otherwise fetch subtitles from the API for this episode.
      // For KAA sources the subtitles are proxied inside fetchAnimeStreamingLinksProxied
      // so they will be CORS-accessible when set here.
      const serverParam =
        sourceType && sourceType !== 'default' && sourceType !== 'direct'
          ? sourceType.toLowerCase()
          : undefined;
      try {
        const subtitleResponse = await fetchAnimeStreamingLinksProxied(
          episodeId,
          episodeProvider || 'kickassanime',
          serverParam,
          serverUrl,
        );
        if (fetchToken !== fetchAbortRef.current) return; // stale
        if (subtitleResponse?.subtitles?.length) {
          console.log('[Player] KAA hlsDirectUrl: setting proxied subtitles from API:', subtitleResponse.subtitles.length);
          setSubtitles(subtitleResponse.subtitles);
        }
      } catch (subErr) {
        console.warn('[Player] KAA hlsDirectUrl: failed to fetch subtitles:', subErr);
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

        // Use sourceIsDub() instead of raw `source.isDub` — providers like
        // AniDB never set `isDub` on their source objects, only a `quality`
        // string ("English Dub" / "Japanese Sub"). Reading `source.isDub`
        // directly meant this filter always failed for AniDB, so we fell
        // through to "take every m3u8 source" and always played sources[0]
        // (the Dub track) regardless of which one the user picked.
        const candidateSources = response.sources.filter(
          (source) =>
            isHlsSource(source) &&
            (isDubServer === undefined || sourceIsDub(source) === isDubServer),
        );
        const m3u8Sources =
          candidateSources.length > 0
            ? candidateSources
            : response.sources.filter(
                isHlsSource,
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

    if (!isLoggedIn || !accessToken || !settings.aniListSync) return;

    // ── NSFW / Hentai AniList sync guard ──────────────────────────────────
    const isHentaiContent = animeGenres.some((g) => g.toLowerCase() === 'hentai');
    const isNsfwContent = animeIsAdult || animeGenres.some((g) => g.toLowerCase() === 'ecchi');

    if (isHentaiContent && !settings.saveHentaiAnilist) return;
    if (!isHentaiContent && isNsfwContent && !settings.saveNSFWAnilist) return;
    // ────────────────────────────────────────────────────────────────────

    try {
      // The app's `animeId` (from the /watch/:animeId route, backed by the
      // meta/anilist API) IS the AniList media ID. Use it directly instead of
      // doing a malId → AniList ID round-trip, which previously made sync
      // silently no-op whenever `malId` was missing.
      let aniListId: number | null = animeId ? parseInt(animeId, 10) : NaN;

      // Fall back to the MAL conversion only if we genuinely don't have an
      // AniList-shaped id.
      if ((!aniListId || isNaN(aniListId)) && malId) {
        const malIdNum = parseInt(malId, 10);
        if (!isNaN(malIdNum)) {
          aniListId = await getAniListIdFromMalId(malIdNum);
        }
      }

      if (!aniListId || isNaN(aniListId)) {
        console.warn('⚠️ [AniList] Could not resolve AniList media ID for progress sync.');
        return;
      }

      // syncWatchProgress auto-promotes PLANNING→CURRENT and →COMPLETED on the
      // final episode (when totalEpisodes is known).
      await syncWatchProgress(accessToken, aniListId, episodeNumber, totalEpisodes);
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

  const updateCaptionFontWeight = () => {
    setCaptionFontWeight(DEFAULT_CAPTION_FONT_WEIGHT);
    localStorage.setItem('zenime-caption-font-weight', DEFAULT_CAPTION_FONT_WEIGHT);
  };

  const applyCaptionStyles = () => {
    const playerElement = player.current?.el as HTMLElement | null;
    if (!playerElement) return;

    playerElement.style.setProperty('--media-user-font-weight', captionFontWeight);
    playerElement.style.setProperty(
      '--media-user-text-shadow',
      createCaptionTextShadow(DEFAULT_CAPTION_OUTLINE_WIDTH),
    );
  };

  useEffect(() => {
    applyCaptionStyles();
    const frame = window.requestAnimationFrame(applyCaptionStyles);
    return () => window.cancelAnimationFrame(frame);
  }, [captionFontWeight]);

  const activeSkipTime = skipTimes.find(
    ({ interval }) =>
      currentTime >= interval.startTime && currentTime < interval.endTime,
  );

  const skipActiveSegment = () => {
    if (activeSkipTime && player.current) {
      player.current.currentTime = activeSkipTime.interval.endTime;
      setCurrentTime(activeSkipTime.interval.endTime);
    }
  };

  const handlePlaybackEnded = async () => {
    const transitionLockUntil = playbackTransitionLockUntilRef.current;
    if (playbackTransitionRef.current || (transitionLockUntil > 0 && Date.now() < transitionLockUntil)) {
      return;
    }

    playbackTransitionRef.current = true;
    playbackTransitionLockUntilRef.current = Date.now() + 2_000;

    try {
      if (propEpisodeNumber) {
        await saveAniListProgress(propEpisodeNumber);
      }
      if (!autoNextRef.current) return;
      player.current?.pause();
      await new Promise((resolve) => setTimeout(resolve, 250));
      await onEpisodeEndRef.current();
    } catch (error) {
      console.error('Error moving to the next episode:', error);
    } finally {
      window.setTimeout(() => {
        playbackTransitionRef.current = false;
        playbackTransitionLockUntilRef.current = 0;
      }, 2_200);
    }
  };

  return (
    <div style={{ animation: 'popIn 0.25s ease-in-out' }}>
      {/* Embedded iframe player — key forces full remount when URL changes */}
      {isEmbedded && (
        <EmbeddedPlayerWrapper>
          <EmbeddedIframeWrapper key={stableIframeKey}>
            {builtEmbeddedUrl && (
              <EmbeddedIframe
                src={builtEmbeddedUrl}
                allowFullScreen
                allow="accelerometer; gyroscope; magnetometer; autoplay; fullscreen; picture-in-picture; screen-wake-lock"
                title={`${animeVideoTitle || 'Anime'} - Episode ${episodeNumber}`}
              />
            )}
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
          <PlayerViewport>
            <MediaPlayer
              key={`player-${episodeId}-${sourceType}-${hlsDirectUrl || serverUrl}`}
              className='player'
              title={`${animeVideoTitle || 'Anime'} - Episode ${episodeNumber}`}
              src={src}
              autoplay={autoPlay && userInteracted}
              muted={false}
              playsinline
              onLoadedMetadata={onLoadedMetadata}
              onCanPlay={onCanPlay}
              onError={onMediaError}
              onProviderChange={onProviderChange}
              onTimeUpdate={onTimeUpdate}
              onSeeked={onSeeked}
              ref={player}
              aspectRatio='16/9'
              load='eager'
              posterLoad='eager'
              streamType='on-demand'
              storage='storage-key'
              keyTarget='player'
              style={{
                '--media-user-font-weight': captionFontWeight,
                '--media-user-text-shadow': createCaptionTextShadow(
                  DEFAULT_CAPTION_OUTLINE_WIDTH,
                ),
              }}
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
                  subtitles.map((subtitle, index) => {
                    const language = subtitle.lang || 'Unknown';
                    const duplicateCount = subtitles
                      .slice(0, index)
                      .filter((item) => item.lang === language).length;
                    const hasDuplicateLanguage = subtitles.some(
                      (item) => item.lang === language,
                    ) && subtitles.filter((item) => item.lang === language).length > 1;
                    const label = hasDuplicateLanguage
                      ? `${language} ${duplicateCount + 1}`
                      : language;

                    return (
                      <Track
                        key={`subtitle-${index}-${subtitle.url}`}
                        kind='subtitles'
                        src={subtitle.url}
                        label={label}
                        default={index === 0}
                      />
                    );
                  })}
              </MediaProvider>
              <DefaultAudioLayout icons={defaultLayoutIcons} />
              <DefaultVideoLayout
                icons={defaultLayoutIcons}
                slots={{
                  timeSlider: <ChapterTimeSlider />,
                  accessibilityMenuItemsEnd: (
                    <CaptionStyleExtensions
                      player={player}
                      fontWeight={captionFontWeight}
                      onFontWeightChange={updateCaptionFontWeight}
                    />
                  ),
                }}
              />
              {activeSkipTime && (
                <SkipSegmentButton type='button' onClick={skipActiveSegment}>
                  Skip {activeSkipTime.skipType === 'op' ? 'Intro' : 'Outro'}
                </SkipSegmentButton>
              )}
            </MediaPlayer>
          </PlayerViewport>
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