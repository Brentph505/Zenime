/**
 * Redis Client Wrapper
 * Connects to Upstash Redis REST API with automatic fallback to memory cache.
 * Supports pipeline batching and exponential-backoff retries.
 */

export interface RedisClientConfig {
  url?: string;
  token?: string;
  maxRetries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
}

interface UpstashResponse<T> {
  result: T;
  error?: string;
}

class RedisClientWrapper {
  private readonly baseUrl: string | null;
  private readonly token: string | null;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private readonly timeoutMs: number;
  private _available: boolean = false;

  constructor(config?: RedisClientConfig) {
    this.baseUrl = config?.url ?? (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_REDIS_URL : null) ?? null;
    this.token  = config?.token ?? (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_REDIS_TOKEN : null) ?? null;
    this.maxRetries   = config?.maxRetries   ?? 2;
    this.retryDelayMs = config?.retryDelayMs ?? 300;
    this.timeoutMs    = config?.timeoutMs    ?? 5_000;

    if (this.baseUrl && this.token) {
      this._available = true;
      console.log('✅ [Redis] Client ready');
    } else {
      console.warn('⚠️  [Redis] Not configured — running in memory-only mode');
    }
  }

  isRedisAvailable(): boolean {
    return this._available;
  }

  // ── Core request ──────────────────────────────────────────────────────────

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: string,
    attempt = 0,
  ): Promise<T | null> {
    if (!this._available || !this.baseUrl || !this.token) return null;

    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${this.token}`,
      };
      if (body !== undefined) headers['Content-Type'] = 'text/plain';

      const res = await fetch(url, {
        method,
        headers,
        body,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }

      const json = (await res.json()) as UpstashResponse<T>;
      if (json.error) throw new Error(json.error);
      return json.result ?? null;
    } catch (err: any) {
      clearTimeout(timeout);
      const isRetryable = err?.name !== 'AbortError' && attempt < this.maxRetries;
      if (isRetryable) {
        await this.sleep(this.retryDelayMs * 2 ** attempt);
        return this.request<T>(method, path, body, attempt + 1);
      }
      // Mark Redis as unavailable on repeated failures so we stop hammering it
      if (attempt >= this.maxRetries) {
        console.error(`❌ [Redis] Disabling after ${attempt + 1} failed attempts`);
        this._available = false;
      }
      return null;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  // ── Commands ──────────────────────────────────────────────────────────────

  async get(key: string): Promise<string | null> {
    const res = await this.request<string>('GET', `/get/${enc(key)}`);
    return res ?? null;
  }

  async set(key: string, value: string, exSeconds?: number): Promise<boolean> {
    let res: string | null;
    if (exSeconds && exSeconds > 0) {
      // SETEX key seconds value
      res = await this.request<string>(
        'POST',
        `/setex/${enc(key)}/${exSeconds}`,
        value,
      );
    } else {
      res = await this.request<string>('POST', `/set/${enc(key)}`, value);
    }
    return res === 'OK';
  }

  async del(key: string): Promise<boolean> {
    const res = await this.request<number>('POST', `/del/${enc(key)}`);
    return (res ?? 0) > 0;
  }

  async exists(key: string): Promise<boolean> {
    const res = await this.request<number>('GET', `/exists/${enc(key)}`);
    return (res ?? 0) > 0;
  }

  async ttl(key: string): Promise<number> {
    const res = await this.request<number>('GET', `/ttl/${enc(key)}`);
    return res ?? -2; // -2 = key not found, -1 = no expiry
  }

  /**
   * Keys matching a pattern — use sparingly in production.
   * Upstash supports KEYS via the pipeline endpoint.
   */
  async keys(pattern: string): Promise<string[]> {
    const res = await this.request<string[]>('GET', `/keys/${enc(pattern)}`);
    return res ?? [];
  }

  async flushAll(): Promise<boolean> {
    const res = await this.request<string>('POST', '/flushall');
    return res === 'OK';
  }

  async incr(key: string): Promise<number> {
    const res = await this.request<number>('POST', `/incr/${enc(key)}`);
    return res ?? 0;
  }

  async ping(): Promise<boolean> {
    const res = await this.request<string>('GET', '/ping');
    const ok = res === 'PONG';
    if (!ok) this._available = false;
    return ok;
  }

  /**
   * Pipeline: execute multiple commands in a single HTTP round-trip.
   * Each command is [command, ...args].
   * Returns array of results in same order.
   */
  async pipeline(
    commands: Array<[string, ...string[]]>,
  ): Promise<Array<unknown>> {
    if (!this._available || !this.baseUrl || !this.token) return [];
    try {
      const res = await fetch(`${this.baseUrl}/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(commands),
      });
      if (!res.ok) return [];
      const json = (await res.json()) as Array<UpstashResponse<unknown>>;
      return json.map((r) => r.result ?? null);
    } catch {
      return [];
    }
  }

  /**
   * Batch-delete keys using a pipeline (avoids N round-trips).
   */
  async delMany(keys: string[]): Promise<number> {
    if (!keys.length) return 0;
    const cmds = keys.map((k): [string, string] => ['DEL', k]);
    const results = await this.pipeline(cmds);
    return results.filter((r) => (r as number) > 0).length;
  }

  /**
   * Re-enable Redis after it was auto-disabled (call after fixing config).
   */
  reconnect(): void {
    if (this.baseUrl && this.token) {
      this._available = true;
      console.log('🔄 [Redis] Reconnected');
    }
  }
}

function enc(s: string): string {
  return encodeURIComponent(s);
}

export const redisClient = new RedisClientWrapper();
export { RedisClientWrapper };