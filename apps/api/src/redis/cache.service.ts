import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

// Cache de leitura (seção 8): catálogo (TTL 1h), perfil público (TTL 5min),
// feed explorar (TTL 60s). Invalidação por evento, nunca por polling.
@Injectable()
export class CacheService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async delByPrefix(prefix: string): Promise<void> {
    const stream = this.redis.scanStream({ match: `${prefix}*`, count: 100 });
    const pipeline = this.redis.pipeline();
    let found = false;
    for await (const keys of stream) {
      if (keys.length) {
        found = true;
        keys.forEach((key: string) => pipeline.del(key));
      }
    }
    if (found) await pipeline.exec();
  }
}

export const CacheTTL = {
  CATALOG_SEARCH: 60 * 60,
  PUBLIC_PROFILE: 5 * 60,
  EXPLORE_FEED: 60,
  ENTITLEMENTS: 5 * 60,
} as const;
