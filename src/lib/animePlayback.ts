import { proxyDirectMediaUrls } from './streamUrlProxy';

type AnimeProviderConfig = {
  referer?: string;
  playback?: 'hls' | 'embed' | 'anidb';
  proxy?:
    | 'animeparadies'
    | '4animo'
    | 'anikoto'
    | 'reanime'
    | 'kickassanime'
    | 'animepahe'
    | 'xanime'
    | 'anidb'
    | 'legacy'
    | 'none';
  proxyDirectMedia?: boolean;
  subtitleProxy?: 'kaa' | 'xanime' | 'hstream';
};

type ProxySource = {
  url?: string;
  [key: string]: unknown;
};

type AnimeStreamingResponse = {
  servers?: Array<{ name?: string; url?: string; [key: string]: unknown }>;
  sources?: ProxySource[];
  subtitles?: Array<{ url: string; lang: string }>;
  [key: string]: unknown;
};

export const HENTAI_ANIME_PROVIDERS = [
  'hentaimama',
  'watchhentai',
  'hstream',
  'hahomoe',
] as const;

export const DEFAULT_ANIME_PROVIDERS = [
  'animeparadies',
  '4animo',
  'anikoto',
  'reanime',
  'kickassanime',
  'animepahe',
  'xanime',
];

export const WATCH_ANIME_PROVIDERS = [...DEFAULT_ANIME_PROVIDERS, 'anidb'];

const ANIME_INFO_PROVIDER_ORDERS: Record<string, string[]> = {
  animeparadies: ['animeparadies', '4animo', 'anikoto', 'reanime', 'kickassanime', 'animepahe', 'xanime'],
  '4animo': ['4animo', 'animeparadies', 'anikoto', 'reanime', 'kickassanime', 'animepahe', 'xanime'],
  xanime: ['xanime', 'animeparadies', '4animo', 'anikoto', 'reanime', 'kickassanime', 'animepahe'],
  animepahe: ['animepahe', 'animeparadies', '4animo', 'anikoto', 'reanime', 'kickassanime', 'xanime'],
  kickassanime: ['kickassanime', 'animeparadies', '4animo', 'anikoto', 'reanime', 'animepahe', 'xanime'],
  reanime: ['reanime', 'animeparadies', '4animo', 'anikoto', 'kickassanime', 'animepahe', 'xanime'],
  anidb: ['anidb', 'anikoto', 'animeparadies', '4animo', 'reanime', 'kickassanime', 'animepahe', 'xanime'],
};

export function getAnimeInfoProviderOrder(preferredProvider?: string): string[] {
  const preferredOrder =
    ANIME_INFO_PROVIDER_ORDERS[preferredProvider || ''] ||
    ['anikoto', 'animeparadies', '4animo', 'reanime', 'kickassanime', 'animepahe', 'xanime'];
  return [...new Set([...preferredOrder, ...WATCH_ANIME_PROVIDERS])];
}

export const ANIME_PROVIDER_PRIORITY = [
  ...HENTAI_ANIME_PROVIDERS,
  'animeparadies',
  '4animo',
  'anikoto',
  'reanime',
  'kickassanime',
  'animepahe',
  'xanime',
];

const M3U8_PROXY_URL = import.meta.env.VITE_M3U8_PROXY_URL as string;
const M3U8_PROXY_URL_2 = import.meta.env.VITE_M3U8_PROXY_URL_2 as string;
const M3U8_PROXY_URL_ANIDB = import.meta.env.VITE_M3U8_PROXY_URL_ANIDB as string;
const M3U8_PROXY_URL_XANIME = import.meta.env.VITE_M3U8_PROXY_URL_XANIME as string;
const PROVIDER_M3U8_PROXY_URLS = {
  animeparadies: import.meta.env.VITE_M3U8_PROXY_URL_ANIMEPARADIES as string,
  '4animo': import.meta.env.VITE_M3U8_PROXY_URL_4ANIMO as string,
  anikoto: import.meta.env.VITE_M3U8_PROXY_URL_ANIKOTO as string,
  reanime:
    (import.meta.env.VITE_M3U8_PROXY_URL_REANIME as string) || M3U8_PROXY_URL_2,
  kickassanime: import.meta.env.VITE_M3U8_PROXY_URL_KICKASSANIME as string,
  animepahe: import.meta.env.VITE_M3U8_PROXY_URL_ANIMEPAHE as string,
  xanime: M3U8_PROXY_URL_XANIME,
  anidb: M3U8_PROXY_URL_ANIDB,
};
const KAA_SUBTITLE_PROXY_URL = import.meta.env.VITE_KICKASSANIME_SUBTITLE_PROXY as string;
const HENTAIMAMA_PROXY_URL = import.meta.env.VITE_PROXY_HENTAIMAMA as string;
const WATCHHENTAI_PROXY_URL = import.meta.env.VITE_PROXY_WATCHHENTAI as string;

export const ANIME_PROVIDERS: Record<string, AnimeProviderConfig> = {
  animeparadies: {
    referer: 'https://stream.animeparadise.moe',
    playback: 'hls',
    proxy: 'animeparadies',
    proxyDirectMedia: true,
  },
  '4animo': { referer: 'https://4animo.xyz', playback: 'embed', proxy: '4animo' },
  anikoto: { referer: 'https://anikoto.to', playback: 'embed', proxy: 'anikoto' },
  reanime: {
    referer: 'https://reanime.to',
    playback: 'embed',
    proxy: 'reanime',
    proxyDirectMedia: true,
  },
  kickassanime: {
    referer: 'https://krussdomi.com',
    playback: 'hls',
    proxy: 'kickassanime',
    proxyDirectMedia: true,
    subtitleProxy: 'kaa',
  },
  animepahe: {
    referer: 'https://animepahe.com',
    playback: 'hls',
    proxy: 'animepahe',
  },
  xanime: {
    referer: 'https://xanime.me/',
    playback: 'hls',
    proxy: 'xanime',
    proxyDirectMedia: true,
    subtitleProxy: 'xanime',
  },
  anidb: {
    referer: 'https://anidb.app',
    playback: 'hls',
    proxy: 'anidb',
    proxyDirectMedia: true,
  },
  hentaimama: { proxy: 'legacy' },
  watchhentai: { proxy: 'none' },
  hstream: { proxy: 'legacy', subtitleProxy: 'hstream' },
  hahomoe: { proxy: 'legacy' },
};

export const HLS_FIRST_PROVIDERS = new Set(
  Object.entries(ANIME_PROVIDERS)
    .filter(([, config]) => config.playback === 'hls')
    .map(([provider]) => provider),
);

export function isHentaiAnimeProvider(provider: string): boolean {
  return HENTAI_ANIME_PROVIDERS.includes(
    provider as (typeof HENTAI_ANIME_PROVIDERS)[number],
  );
}

export function resolveProviderReferer(provider?: string, fallback?: string): string {
  const normalized = provider?.toLowerCase();
  const providerReferer = normalized && ANIME_PROVIDERS[normalized]?.referer;
  if (providerReferer) return providerReferer;

  if (fallback && /^https?:\/\//i.test(fallback)) return fallback;
  return 'https://krussdomi.com';
}

function getProxyConfig(provider: string): { url?: string; fallbackSetting?: string } {
  const proxy = ANIME_PROVIDERS[provider]?.proxy;
  if (proxy === 'none') return {};
  if (proxy === 'legacy' || !proxy) return { url: M3U8_PROXY_URL };

  const providerUrl = PROVIDER_M3U8_PROXY_URLS[proxy];
  const legacyUrl = proxy === 'reanime' ? M3U8_PROXY_URL_2 : M3U8_PROXY_URL;
  const fallbackSetting = `VITE_M3U8_PROXY_URL_${proxy.toUpperCase()}`;

  return {
    url: providerUrl || legacyUrl,
    fallbackSetting: providerUrl ? undefined : fallbackSetting,
  };
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/** Detects direct media even when nested inside one or more `?url=` proxies. */
export function getDirectMediaType(url: string): 'hls' | 'mp4' | 'webm' | null {
  let candidate = url;

  for (let depth = 0; candidate && depth < 4; depth++) {
    if (/\.m3u8(?:[?#]|$)|\/m3u8(?:[?#]|$)|\/manifest\//i.test(candidate)) return 'hls';
    if (/\.mp4(?:[?#]|$)/i.test(candidate)) return 'mp4';
    if (/\.webm(?:[?#]|$)/i.test(candidate)) return 'webm';

    try {
      const nestedUrl = new URL(candidate).searchParams.get('url');
      if (!nestedUrl || nestedUrl === candidate) return null;
      candidate = nestedUrl;
    } catch {
      return null;
    }
  }

  return null;
}

export function isDirectMediaUrl(url: string): boolean {
  return getDirectMediaType(url) !== null;
}

export function isEmbeddedPlaybackServer(
  url: string,
  type?: string,
  provider?: string,
): boolean {
  if (isDirectMediaUrl(url)) return false;

  const normalizedType = (type || '').toLowerCase();
  const normalizedProvider = (provider || '').toLowerCase();
  const playback = ANIME_PROVIDERS[normalizedProvider]?.playback;

  if (playback === 'hls') {
    return url.includes('iframe') || url.includes('kwik.cx') || normalizedType === 'iframe';
  }

  if (playback === 'embed') {
    return (
      url.includes('iframe') ||
      url.includes('kwik.cx') ||
      url.includes('flixcloud') ||
      normalizedType === 'iframe' ||
      normalizedType === 'sub' ||
      normalizedType === 'dub' ||
      normalizedType === 'hsub'
    );
  }

  if (playback === 'anidb') {
    return url.includes('/embed/') || normalizedType === 'iframe';
  }

  return (
    url.includes('iframe') ||
    url.includes('kwik.cx') ||
    url.includes('flixcloud') ||
    normalizedType === 'iframe'
  );
}

export function buildM3U8ProxyUrl(
  sourceUrl: string,
  referer: string,
  proxyUrl?: string,
  includeHeaders: boolean = true,
  provider?: string,
): string {
  const selectedProxy = proxyUrl || M3U8_PROXY_URL;

  if (!selectedProxy) {
    console.warn('⚠️ No M3U8 proxy is configured. Returning original URL.');
    return sourceUrl;
  }
  if (sourceUrl.includes(selectedProxy)) return sourceUrl;
  if (!isValidUrl(sourceUrl)) {
    console.warn('⚠️ Invalid source URL. Returning as-is.');
    return sourceUrl;
  }

  const proxyBase = selectedProxy.replace(/\/$/, '');
  let proxied = `${proxyBase}/m3u8-proxy?url=${encodeURIComponent(sourceUrl)}`;

  if (includeHeaders) {
    const resolvedReferer = resolveProviderReferer(provider, referer);
    const origin = (() => {
      try {
        return new URL(resolvedReferer).origin;
      } catch {
        return new URL('https://krussdomi.com').origin;
      }
    })();
    const proxyHeaders = JSON.stringify({ Referer: resolvedReferer, Origin: origin });
    proxied += `&headers=${encodeURIComponent(proxyHeaders)}`;
  }

  return proxied;
}

function buildSubtitleProxyUrl(subtitleUrl: string, proxy: string, provider: string): string {
  if (!proxy) {
    console.warn(`⚠️ No ${provider} subtitle proxy configured. Returning original URL.`);
    return subtitleUrl;
  }
  if (!isValidUrl(subtitleUrl)) return subtitleUrl;

  const proxyBase = proxy.replace(/\/+$/, '');
  if (subtitleUrl.includes(proxyBase)) return subtitleUrl;

  const hasSubtitlePath = /\/subtitle$/i.test(proxyBase);
  const separator = proxyBase.includes('?') ? '&' : '?';
  const pathSuffix = hasSubtitlePath ? '' : '/subtitle';
  return `${proxyBase}${pathSuffix}${separator}url=${encodeURIComponent(subtitleUrl)}`;
}

export function buildKaaSubtitleProxyUrl(subtitleUrl: string): string {
  return buildSubtitleProxyUrl(subtitleUrl, KAA_SUBTITLE_PROXY_URL, 'KAA (VITE_KICKASSANIME_SUBTITLE_PROXY)');
}

export function buildXanimeSubtitleProxyUrl(subtitleUrl: string): string {
  return buildSubtitleProxyUrl(subtitleUrl, M3U8_PROXY_URL_XANIME, 'Xanime (VITE_M3U8_PROXY_URL_XANIME)');
}

export function proxyKaaSubtitles(subtitles: Array<{ url: string; lang: string }>) {
  if (!KAA_SUBTITLE_PROXY_URL) return subtitles;
  return subtitles.map((subtitle) => ({ ...subtitle, url: buildKaaSubtitleProxyUrl(subtitle.url) }));
}

export function proxyXanimeSubtitles(subtitles: Array<{ url: string; lang: string }>) {
  if (!M3U8_PROXY_URL_XANIME) return subtitles;
  return subtitles.map((subtitle) => ({ ...subtitle, url: buildXanimeSubtitleProxyUrl(subtitle.url) }));
}

export function proxyHstreamSubtitles(subtitles: Array<{ url: string; lang: string }>) {
  if (!KAA_SUBTITLE_PROXY_URL) return subtitles;

  return subtitles.map((subtitle) => {
    let sourceUrl = subtitle.url;
    try {
      sourceUrl = new URL(subtitle.url).searchParams.get('url') || subtitle.url;
    } catch {
      // Keep the original URL when it is not a wrapped proxy URL.
    }
    return { ...subtitle, url: buildKaaSubtitleProxyUrl(sourceUrl) };
  });
}

export function proxyM3U8Sources(
  sources: ProxySource[],
  referer: string,
  proxyUrl?: string,
  includeHeaders: boolean = true,
  provider?: string,
): ProxySource[] {
  const selectedProxy = proxyUrl || M3U8_PROXY_URL;
  if (!selectedProxy) return sources;

  return sources.map((source) => {
    if (source.url?.endsWith('.m3u8') && isValidUrl(source.url)) {
      if (source.url.includes(selectedProxy)) return source;
      return {
        ...source,
        url: buildM3U8ProxyUrl(source.url, referer, proxyUrl, includeHeaders, provider),
      };
    }
    return source;
  });
}

export function proxyAnimeMediaUrl(
  sourceUrl: string,
  provider: string,
  referer?: string,
): string {
  const config = ANIME_PROVIDERS[provider];
  const proxyUrl = getProxyConfig(provider).url;
  if (!config?.proxyDirectMedia || !proxyUrl) return sourceUrl;

  const providerReferer = resolveProviderReferer(provider, referer || 'https://reanime.to');
  return buildM3U8ProxyUrl(sourceUrl, providerReferer, proxyUrl, true, provider);
}

export function proxyAnimeStreamingResponse<T extends AnimeStreamingResponse>(
  data: T,
  provider: string,
  server?: string,
  referer?: string,
): T {
  const config = ANIME_PROVIDERS[provider];
  const { url: proxyUrl, fallbackSetting } = getProxyConfig(provider);

  if (config?.subtitleProxy === 'hstream' && Array.isArray(data?.subtitles)) {
    const seenLanguages = new Set<string>();
    const uniqueSubtitles = data.subtitles.filter((subtitle: { lang?: string }) => {
      const language = subtitle.lang?.trim().toLowerCase();
      if (!language) return true;
      if (seenLanguages.has(language)) return false;
      seenLanguages.add(language);
      return true;
    });
    data.subtitles = proxyHstreamSubtitles(uniqueSubtitles);
  }

  if (config?.proxy === 'none') return data;
  if (!proxyUrl) {
    console.warn('⚠️ M3U8 proxy skipped: missing proxy configuration.');
    return data;
  }

  if (fallbackSetting && !getConfiguredProviderProxy(provider)) {
    console.warn(`⚠️ ${provider} is using the fallback M3U8 proxy because ${fallbackSetting} is not set.`);
  }

  let serverUrl = resolveProviderReferer(provider, referer || 'https://reanime.to');
  if (Array.isArray(data?.servers) && data.servers.length > 0) {
    const preferredMatch =
      (server &&
        data.servers.find(
          (candidate) =>
            candidate.name?.toLowerCase() === server.toLowerCase() &&
            (provider === 'kickassanime'
              ? candidate.url?.includes('kickassanime') || candidate.name?.toLowerCase().includes('kaa')
              : true),
        )) || data.servers.find((candidate) => candidate.url && candidate.url.startsWith('http'));
    if (preferredMatch?.url) serverUrl = preferredMatch.url;
  }

  if (!serverUrl) {
    console.warn('⚠️ M3U8 proxy skipped: no server URL available.');
    return data;
  }

  const providerReferer = resolveProviderReferer(provider, serverUrl);
  console.log(`[fetchAnimeStreamingLinksProxied] Using referer/origin for provider=${provider}: ${providerReferer}`);

  if (Array.isArray(data?.sources)) {
    data.sources = proxyM3U8Sources(data.sources, providerReferer, proxyUrl, true, provider);
  }

  if (config?.proxyDirectMedia) {
    data = proxyDirectMediaUrls(
      data,
      provider,
      providerReferer,
      (sourceUrl: string, sourceReferer: string) =>
        buildM3U8ProxyUrl(sourceUrl, sourceReferer, proxyUrl, true, provider),
    ) ?? data;
  }

  if (config?.subtitleProxy === 'kaa' && Array.isArray(data?.subtitles) && data.subtitles.length > 0) {
    console.log('[fetchAnimeStreamingLinksProxied] Proxying KAA subtitles:', data.subtitles.length);
    data.subtitles = proxyKaaSubtitles(data.subtitles);
  }
  if (config?.subtitleProxy === 'xanime' && Array.isArray(data?.subtitles) && data.subtitles.length > 0) {
    console.log('[fetchAnimeStreamingLinksProxied] Proxying Xanime subtitles:', data.subtitles.length);
    data.subtitles = proxyXanimeSubtitles(data.subtitles);
  }

  return data;
}

function getConfiguredProviderProxy(provider: string): string | undefined {
  const proxy = ANIME_PROVIDERS[provider]?.proxy;
  if (proxy === 'none') return undefined;
  if (proxy === 'legacy' || !proxy) return M3U8_PROXY_URL;
  return PROVIDER_M3U8_PROXY_URLS[proxy];
}

export function proxyHentaiMp4Url(url: string, provider: string, type?: string): string {
  const proxyUrl = provider === 'watchhentai' ? WATCHHENTAI_PROXY_URL : HENTAIMAMA_PROXY_URL;
  if (!url || (provider !== 'hentaimama' && provider !== 'watchhentai') || !proxyUrl) return url;
  const isMp4 = /\.mp4$/i.test(url) || type === 'mp4';
  if (!isMp4) return url;
  return `${proxyUrl.replace(/\/+$/, '')}/?url=${encodeURIComponent(url)}`;
}

export function buildEmbeddedPlayerUrl(
  playerBaseUrl: string,
  proxyUrl: string | undefined,
  id?: string,
  episodeNumber?: string,
  language?: string,
): string {
  if (!playerBaseUrl.trim() || !id || !episodeNumber) return '';
  const cleanBase = playerBaseUrl.replace(/\/+$/, '');
  const type = language === 'dub' ? 'dub' : 'sub';
  const originalUrl = `${cleanBase}/stream/ani/${id}/${episodeNumber}/${type}`;
  return proxyUrl ? `${proxyUrl}?url=${encodeURIComponent(originalUrl)}` : originalUrl;
}

export function createAnimeServerLabeler() {
  const labelCounts = new Map<string, number>();

  const uniqueLabel = (label: string, alwaysNumber = false) => {
    const count = labelCounts.get(label) || 0;
    labelCounts.set(label, count + 1);
    if (alwaysNumber) return `${label} ${count + 1}`;
    return count === 0 ? label : `${label} ${count + 1}`;
  };

  return (
    provider: string,
    name: string,
    type: string,
    quality?: string,
    isEmbedded = false,
  ): string => {
    if (provider === 'anikoto') {
      const normalizedType = type?.toLowerCase();
      const normalizedQuality = (quality || name || '').toLowerCase();
      const label = normalizedQuality.includes('hsub') || normalizedType === 'hsub'
        ? 'Zen HSUB'
        : normalizedQuality.includes('dub') || normalizedType === 'dub'
          ? 'Zen Dub'
          : 'Zen Sub';
      return uniqueLabel(label);
    }
    if (provider === '4animo') {
      const normalizedText = `${name} ${type} ${quality || ''}`.toLowerCase();
      const label = normalizedText.includes('hsub')
        ? 'REI HSUB'
        : normalizedText.includes('dub')
          ? 'REI Dub'
          : 'REI Sub';
      return uniqueLabel(label);
    }
    if (provider === 'kickassanime') return uniqueLabel('KAA');
    if (provider === 'animeparadies') return uniqueLabel('APD');
    if (provider === 'xanime') {
      const normalizedText = `${quality || ''} ${name || ''}`.toLowerCase();
      return uniqueLabel(normalizedText.includes('dub') ? 'XAM Dub' : 'XAM Sub', true);
    }
    if (provider === 'anidb') {
      const normalizedText = (quality || name || '').toLowerCase();
      const baseLabel = normalizedText.includes('dub') || normalizedText.includes('english')
        ? 'ADB Dub'
        : normalizedText.includes('sub') || normalizedText.includes('japanese')
          ? 'ADB Sub'
          : 'ADB';
      return uniqueLabel(isEmbedded ? `${baseLabel} (Embed)` : baseLabel);
    }
    return name;
  };
}