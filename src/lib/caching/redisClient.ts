/**
 * Redis Client Wrapper
 * Handles connections to Upstash Redis or other Redis providers
 * Gracefully falls back to memory cache if Redis is unavailable
 */

interface RedisClientConfig {
  url?: string;
  token?: string;
  retryAttempts?: number;
  retryDelay?: number;
}

class RedisClientWrapper {
  private baseUrl: string | null = null;
  private token: string | null = null;
  private isAvailable: boolean = false;

  constructor(config?: RedisClientConfig) {
    this.baseUrl = config?.url || import.meta.env.VITE_REDIS_URL;
    this.token = config?.token || import.meta.env.VITE_REDIS_TOKEN;

    // Validate configuration
    if (this.baseUrl && this.token) {
      this.isAvailable = true;
      console.log('✅ Redis cache initialized');
    } else {
      console.warn(
        '⚠️  Redis cache not configured. Falling back to memory cache.',
      );
    }
  }

  /**
   * Check if Redis is available
   */
  isRedisAvailable(): boolean {
    return this.isAvailable;
  }

  /**
   * Make a Redis REST API call using Upstash format
   */
  private async makeRequest<T>(
    command: string,
    args: string[],
  ): Promise<T | null> {
    if (!this.isAvailable || !this.baseUrl || !this.token) {
      return null;
    }

    try {
      let fullUrl: string;
      let method: string;
      let body: string | undefined;

      if (command === 'GET') {
        // GET /get/key
        fullUrl = `${this.baseUrl}/get/${encodeURIComponent(args[0])}`;
        method = 'GET';
      } else if (command === 'SET') {
        // POST /set/key with value in body
        fullUrl = `${this.baseUrl}/set/${encodeURIComponent(args[0])}`;
        method = 'POST';
        body = args[1]; // value
      } else if (command === 'SETEX') {
        // POST /setex/key/ttl with value in body
        fullUrl = `${this.baseUrl}/setex/${encodeURIComponent(args[0])}/${args[1]}`;
        method = 'POST';
        body = args[2]; // value
      } else if (command === 'DEL') {
        // POST /del/key
        fullUrl = `${this.baseUrl}/del/${encodeURIComponent(args[0])}`;
        method = 'POST';
      } else {
        throw new Error(`Unsupported command: ${command}`);
      }

      const headers: Record<string, string> = {
        Authorization: `Bearer ${this.token}`,
      };

      if (body !== undefined) {
        headers['Content-Type'] = 'text/plain';
      }

      const response = await fetch(fullUrl, {
        method,
        headers,
        body,
      });

      if (!response.ok) {
        throw new Error(`Redis API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data as T;
    } catch (error) {
      console.error(`❌ [Redis] ${command} failed`);
      return null;
    }
  }

  /**
   * Get a value from Redis
   */
  async get(key: string): Promise<string | null> {
    const result = await this.makeRequest<{ result: string }>('GET', [key]);
    return result?.result ?? null;
  }

  /**
   * Set a value in Redis with optional expiration
   */
  async set(
    key: string,
    value: string,
    exSeconds?: number,
  ): Promise<boolean> {
    try {
      let result;
      if (exSeconds) {
        // Use SETEX for expiration
        result = await this.makeRequest<{ result: string }>('SETEX', [key, exSeconds.toString(), value]);
      } else {
        // Use SET without expiration
        result = await this.makeRequest<{ result: string }>('SET', [key, value]);
      }

      return result?.result === 'OK';
    } catch (error) {
      console.error(`❌ [Redis] SET failed`);
      return false;
    }
  }

  /**
   * Delete a key from Redis
   */
  async del(key: string): Promise<boolean> {
    try {
      const result = await this.makeRequest<{ result: number }>('DEL', [key]);
      return (result?.result ?? 0) > 0;
    } catch (error) {
      console.error(`❌ [Redis] DEL failed`);
      return false;
    }
  }

  /**
   * Check if a key exists in Redis
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.makeRequest<number>('EXISTS', [key]);
      return (result || 0) > 0;
    } catch (error) {
      console.error(`❌ [Redis] EXISTS failed`);
      return false;
    }
  }

  /**
   * Set expiration on a key
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    try {
      const result = await this.makeRequest<number>('EXPIRE', [
        key,
        seconds.toString(),
      ]);
      return (result || 0) > 0;
    } catch (error) {
      console.error(`❌ [Redis] EXPIRE failed`);
      return false;
    }
  }

  /**
   * Get remaining TTL for a key
   */
  async ttl(key: string): Promise<number> {
    try {
      const result = await this.makeRequest<number>('TTL', [key]);
      return result || -2; // -2 = key doesn't exist, -1 = key exists but no expiration
    } catch (error) {
      console.error(`❌ [Redis] TTL failed`);
      return -2;
    }
  }

  /**
   * Get all keys matching a pattern
   */
  async keys(pattern: string): Promise<string[]> {
    try {
      const result = await this.makeRequest<string[]>('KEYS', [pattern]);
      return result || [];
    } catch (error) {
      console.error(`❌ [Redis] KEYS failed`);
      return [];
    }
  }

  /**
   * Clear all keys
   */
  async flushAll(): Promise<boolean> {
    try {
      const result = await this.makeRequest<{ status: string }>(
        'FLUSHALL',
        [],
      );
      return result?.status === 'OK';
    } catch (error) {
      console.error(`❌ [Redis] FLUSHALL failed`);
      return false;
    }
  }

  /**
   * Increment a counter
   */
  async incr(key: string): Promise<number> {
    try {
      const result = await this.makeRequest<number>('INCR', [key]);
      return result || 0;
    } catch (error) {
      console.error(`❌ [Redis] INCR failed`);
      return 0;
    }
  }

  /**
   * Get statistics about the Redis connection
   */
  async ping(): Promise<boolean> {
    try {
      const result = await this.makeRequest<string>('PING', []);
      return result === 'PONG';
    } catch (error) {
      console.error(`❌ [Redis] PING failed`);
      this.isAvailable = false;
      return false;
    }
  }
}

// Export singleton instance
export const redisClient = new RedisClientWrapper();

export type { RedisClientConfig };
export { RedisClientWrapper };
