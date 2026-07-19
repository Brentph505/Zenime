export interface RedisPruneCandidate {
  key: string;
  createdAt: number;
  expiresAt: number | null;
  strategy?: string;
  version?: number;
}

export function selectRedisKeysToPrune(
  entries: RedisPruneCandidate[],
  now: number = Date.now(),
): string[] {
  const candidates = entries.filter((entry) => entry.strategy !== 'permanent');
  const expired = candidates.filter((entry) => entry.expiresAt !== null && entry.expiresAt <= now);
  const toSort = expired.length > 0 ? expired : candidates;

  if (!toSort.length) return [];

  const sorted = [...toSort].sort((a, b) => a.createdAt - b.createdAt);
  const targetCount = Math.max(3, Math.ceil(sorted.length * 0.25));
  return sorted.slice(0, targetCount).map((entry) => entry.key);
}
