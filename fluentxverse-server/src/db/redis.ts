/**
 * Redis-compatible caching utility for Bun
 * Uses in-memory fallback when Redis is unavailable
 */

type CacheStore = Map<string, { value: string; expires: number }>;
type RedisClient = {
  store: CacheStore;
  get(key: string): Promise<string | null>;
  setEx(key: string, ttl: number, value: string): Promise<void>;
  keys(pattern: string): Promise<string[]>;
  del(keys: string[]): Promise<void>;
  lRange(key: string, start: number, stop: number): Promise<string[]>;
  rPush(key: string, value: string): Promise<void>;
  lTrim(key: string, start: number, stop: number): Promise<void>;
};

let redisClient: RedisClient | null = null;
let isConnected = false;

/**
 * Create in-memory Redis-compatible cache client
 */
const createInMemoryCache = (): RedisClient => {
  const store: CacheStore = new Map();

  return {
    store,
    async get(key: string) {
      const entry = store.get(key);
      if (!entry) return null;
      if (Date.now() > entry.expires) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },
    async setEx(key: string, ttl: number, value: string) {
      store.set(key, { value, expires: Date.now() + ttl * 1000 });
    },
    async keys(pattern: string) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return Array.from(store.keys()).filter((k) => regex.test(k));
    },
    async del(keys: string[]) {
      keys.forEach((k) => store.delete(k));
    },
    async lRange(key: string, start: number, stop: number) {
      const entry = store.get(key);
      if (!entry) return [];
      try {
        const arr = JSON.parse(entry.value) as unknown[];
        if (!Array.isArray(arr)) return [];
        if (stop === -1) return arr.slice(start).map((v) => JSON.stringify(v));
        return arr.slice(start, stop + 1).map((v) => JSON.stringify(v));
      } catch {
        return [];
      }
    },
    async rPush(key: string, value: string) {
      let entry = store.get(key);
      let arr: unknown[] = [];
      if (entry) {
        try {
          arr = JSON.parse(entry.value) as unknown[];
          if (!Array.isArray(arr)) arr = [];
        } catch {
          arr = [];
        }
      }
      arr.push(JSON.parse(value));
      store.set(key, { value: JSON.stringify(arr), expires: Date.now() + 30 * 24 * 60 * 60 * 1000 });
    },
    async lTrim(key: string, start: number, stop: number) {
      const entry = store.get(key);
      if (!entry) return;
      try {
        let arr = JSON.parse(entry.value) as unknown[];
        if (!Array.isArray(arr)) return;
        if (stop === -1) arr = arr.slice(start);
        else arr = arr.slice(start, stop + 1);
        store.set(key, { value: JSON.stringify(arr), expires: Date.now() + 30 * 24 * 60 * 60 * 1000 });
      } catch {
        // Ignore parse errors
      }
    },
  };
};

/**
 * Initialize Redis-compatible cache
 */
export const initRedis = async () => {
  try {
    redisClient = createInMemoryCache();
    isConnected = true;
    console.log('✅ Redis-compatible cache initialized (in-memory)');
  } catch (error) {
    console.warn('⚠️ Cache initialization failed:', error);
    isConnected = false;
  }
};

/**
 * Get Redis client instance
 */
export const getRedis = () => redisClient;

/**
 * Check if Redis is connected
 */
export const isRedisConnected = () => isConnected && redisClient !== null;

/**
 * Cache helper: get or set with TTL
 */
export const cacheGetOrSet = async <T>(key: string, ttlSeconds: number, fetchFn: () => Promise<T>): Promise<T> => {
  if (!isRedisConnected()) {
    return fetchFn();
  }

  try {
    const cached = await redisClient!.get(key);
    if (cached) {
      return JSON.parse(cached) as T;
    }

    const value = await fetchFn();
    await redisClient!.setEx(key, ttlSeconds, JSON.stringify(value));
    return value;
  } catch (error) {
    console.warn(`Cache error for key ${key}:`, error);
    return fetchFn();
  }
};

/**
 * Invalidate cache by key pattern
 */
export const invalidateCache = async (pattern: string) => {
  if (!isRedisConnected()) return;

  try {
    const keys = await redisClient!.keys(pattern);
    if (keys.length > 0) {
      await redisClient!.del(keys);
      console.log(`🗑️ Invalidated ${keys.length} cache keys for pattern: ${pattern}`);
    }
  } catch (error) {
    console.warn(`Cache invalidation error for pattern ${pattern}:`, error);
  }
};

/**
 * Cleanup retention: store cleanup history
 */
export const logRetentionCleanup = async (deletedCount: number) => {
  if (!isRedisConnected()) return;

  try {
    const key = 'notifications:cleanup:history';
    const entry = {
      timestamp: new Date().toISOString(),
      deletedCount,
    };
    await redisClient!.rPush(key, JSON.stringify(entry));
    await redisClient!.lTrim(key, -100, -1);
  } catch (error) {
    console.warn('Error logging retention cleanup:', error);
  }
};

/**
 * Get retention cleanup history
 */
export const getRetentionHistory = async () => {
  if (!isRedisConnected()) return [];

  try {
    const key = 'notifications:cleanup:history';
    const entries = await redisClient!.lRange(key, 0, -1);
    return entries.map((e: string) => JSON.parse(e) as { timestamp: string; deletedCount: number });
  } catch (error) {
    console.warn('Error retrieving retention history:', error);
    return [];
  }
};

/**
 * Graceful shutdown
 */
export const closeRedis = async () => {
  if (redisClient) {
    redisClient = null;
    isConnected = false;
    console.log('✅ Cache connection closed');
  }
};
