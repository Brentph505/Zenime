const IMAGE_PROXY_URL = import.meta.env.VITE_IMAGE_PROXY_URL as string;
const HENTAI_IMAGE_PROXY_URL = import.meta.env.VITE_HENTAI_IMAGE_PROXY_URL as string;

export const MANGA_PROVIDERS = ['atsumaru', 'mangahere', 'mangapill', 'mangakatana'] as const;
export const HENTAI_MANGA_PROVIDERS = ['hentaireadio', 'hentai20'] as const;
export const MANGA_CATALOG_PROVIDERS = [
  ...MANGA_PROVIDERS,
  ...HENTAI_MANGA_PROVIDERS,
] as const;

export const MANGA_PROVIDER_LABELS: Record<(typeof MANGA_CATALOG_PROVIDERS)[number], string> = {
  atsumaru: 'ATM',
  mangahere: 'MHR',
  mangapill: 'MPL',
  mangakatana: 'MKT',
  hentaireadio: 'HRI',
  hentai20: 'H20',
};

export type MangaCatalogProvider = (typeof MANGA_CATALOG_PROVIDERS)[number];
export type HentaiMangaProvider = (typeof HENTAI_MANGA_PROVIDERS)[number];
export type MangaProvider =
  | 'mangadex'
  | 'atsumaru'
  | 'mangahere'
  | 'mangakakalot'
  | 'mangapark'
  | 'mangapill'
  | 'mangakatana'
  | 'mangareader'
  | 'mangasee123'
  | HentaiMangaProvider;

export function normalizeMangaProvider(provider: string): string {
  return provider === 'hentairead' ? 'hentaireadio' : provider;
}

export function isHentaiMangaProvider(provider: string): provider is HentaiMangaProvider {
  const normalizedProvider = normalizeMangaProvider(provider);
  return HENTAI_MANGA_PROVIDERS.includes(normalizedProvider as HentaiMangaProvider);
}

export function isMangaCatalogProvider(provider: string): provider is MangaCatalogProvider {
  return MANGA_CATALOG_PROVIDERS.includes(provider as MangaCatalogProvider);
}

export function getMangaProviderFallbackOrder(
  preferredProvider?: string,
  isHentai: boolean = false,
): MangaCatalogProvider[] {
  if (isHentai) return [...HENTAI_MANGA_PROVIDERS];

  if (preferredProvider === 'atsumaru') {
    return ['atsumaru', 'mangahere', 'mangapill', 'mangakatana'];
  }
  if (preferredProvider === 'mangapill') {
    return ['mangapill', 'atsumaru', 'mangahere', 'mangakatana'];
  }
  if (preferredProvider === 'mangakatana') {
    return ['mangakatana', 'mangahere', 'atsumaru', 'mangapill'];
  }
  return ['mangahere', 'atsumaru', 'mangapill', 'mangakatana'];
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function buildProxyUrl(
  imageUrl: string,
  proxyUrl: string,
  provider: string,
  referer?: string,
): string {
  if (!proxyUrl) return imageUrl;
  if (imageUrl.includes(proxyUrl)) return imageUrl;
  if (!isValidUrl(imageUrl)) return imageUrl;

  const proxyBase = proxyUrl.replace(/\/$/, '');
  let proxied = `${proxyBase}/?url=${encodeURIComponent(imageUrl)}&provider=${encodeURIComponent(provider)}`;
  if (referer) proxied += `&referer=${encodeURIComponent(referer)}`;
  return proxied;
}

export function buildImageProxyUrl(
  imageUrl: string,
  provider: string = 'mangahere',
  referer?: string,
): string {
  if (!IMAGE_PROXY_URL) {
    console.warn('⚠️ No image proxy is configured. Returning original URL.');
    return imageUrl;
  }
  if (imageUrl.includes(IMAGE_PROXY_URL)) return imageUrl;
  if (!isValidUrl(imageUrl)) {
    console.warn('⚠️ Invalid image URL. Returning as-is.');
    return imageUrl;
  }
  return buildProxyUrl(imageUrl, IMAGE_PROXY_URL, provider, referer);
}

export function buildHentaiImageProxyUrl(
  imageUrl: string,
  provider: HentaiMangaProvider = 'hentaireadio',
  referer?: string,
): string {
  if (!HENTAI_IMAGE_PROXY_URL) {
    console.warn('⚠️ No dedicated hentai image proxy configured. Returning original URL.');
    return imageUrl;
  }
  if (imageUrl.includes(HENTAI_IMAGE_PROXY_URL)) return imageUrl;
  if (!isValidUrl(imageUrl)) {
    console.warn('⚠️ Invalid image URL. Returning as-is.');
    return imageUrl;
  }
  return buildProxyUrl(imageUrl, HENTAI_IMAGE_PROXY_URL, provider, referer);
}

export function buildMangaImageProxyUrl(
  imageUrl: string,
  provider: MangaCatalogProvider,
  referer?: string,
): string {
  return isHentaiMangaProvider(provider)
    ? buildHentaiImageProxyUrl(imageUrl, provider as HentaiMangaProvider, referer)
    : buildImageProxyUrl(imageUrl, provider, referer);
}
