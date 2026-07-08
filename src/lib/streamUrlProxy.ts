type DirectMediaPayload = {
  sources?: Array<{ url?: string } | undefined>;
  servers?: Array<{ url?: string } | undefined>;
};

export function isDirectMediaLikeUrl(url: string): boolean {
  return Boolean(
    url &&
      (/\.m3u8(\?|$|#)/i.test(url) || /\.mp4(\?|$|#)/i.test(url) || /\/manifest\//i.test(url)),
  );
}

export function proxyDirectMediaUrls<T extends DirectMediaPayload>(
  data: T | null | undefined,
  provider: string,
  referer: string,
  buildProxyUrl: (sourceUrl: string, referer: string) => string,
): T | null | undefined {
  if (!data || typeof data !== 'object' || !['kickassanime', 'reanime'].includes(provider)) {
    return data;
  }

  const proxyMediaEntry = (entry: { url?: string } | undefined) => {
    if (!entry?.url || !isDirectMediaLikeUrl(entry.url)) {
      return entry;
    }

    return {
      ...entry,
      url: buildProxyUrl(entry.url, referer),
    };
  };

  if (Array.isArray(data.servers)) {
    data.servers = data.servers.map(proxyMediaEntry);
  }

  if (Array.isArray(data.sources)) {
    data.sources = data.sources.map(proxyMediaEntry);
  }

  return data;
}
