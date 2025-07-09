import { createClient } from 'redis';

export type RedisClient = ReturnType<typeof createClient>;

let redisClient: RedisClient | null = null;

export async function getRedisClient(): Promise<RedisClient> {
  if (!redisClient) {
    // Check if Redis should be used
    if (!process.env.REDIS_URL || process.env.USE_SUPABASE_CACHE === 'true') {
      throw new Error('Redis is disabled. Using Supabase cache instead.');
    }

    redisClient = createClient({
      url: process.env.REDIS_URL,
      socket: {
        connectTimeout: 5000,
        reconnectStrategy: (retries) => {
          if (retries > 3) {
            console.error('Redis connection failed after 3 retries');
            return new Error('Redis connection failed');
          }
          return Math.min(retries * 100, 3000);
        }
      }
    });

    redisClient.on('error', (err) => console.error('Redis Client Error', err));
    redisClient.on('connect', () => console.log('Redis Client Connected'));

    await redisClient.connect();
  }

  return redisClient;
}

export async function closeRedisClient(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

// Cache helper functions
export async function cacheGet(key: string): Promise<string | null> {
  const client = await getRedisClient();
  return client.get(key);
}

export async function cacheSet(
  key: string,
  value: string,
  expirationSeconds?: number
): Promise<void> {
  const client = await getRedisClient();
  if (expirationSeconds) {
    await client.setEx(key, expirationSeconds, value);
  } else {
    await client.set(key, value);
  }
}

export async function cacheDelete(key: string): Promise<void> {
  const client = await getRedisClient();
  await client.del(key);
}

export async function cacheExists(key: string): Promise<boolean> {
  const client = await getRedisClient();
  return (await client.exists(key)) === 1;
}

// Pattern-based operations
export async function cacheGetByPattern(pattern: string): Promise<string[]> {
  const client = await getRedisClient();
  return client.keys(pattern);
}

export async function cacheDeleteByPattern(pattern: string): Promise<void> {
  const client = await getRedisClient();
  const keys = await client.keys(pattern);
  if (keys.length > 0) {
    await client.del(keys);
  }
}