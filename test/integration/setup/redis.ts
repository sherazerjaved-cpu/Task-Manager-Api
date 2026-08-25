import Redis from 'ioredis';

let redis: Redis | undefined;

export function getTestRedis(): Redis {
  if (!redis || redis.status === 'end') {
    redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
  }

  return redis;
}

export async function clearRedis(): Promise<void> {
  const client = getTestRedis();

  await client.flushdb();
}

export async function closeRedis(): Promise<void> {
  if (redis && redis.status !== 'end') {
    await redis.quit();
  }

  redis = undefined;
}
