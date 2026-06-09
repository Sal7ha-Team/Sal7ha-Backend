import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);
  private client?: Redis;
  private available = false;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    if (this.config.get<string>('REDIS_CACHE_ENABLED') === 'false') {
      this.logger.warn('Redis cache is disabled by REDIS_CACHE_ENABLED=false');
      return;
    }

    const redisUrl =
      this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
    this.client = new Redis(redisUrl, {
      connectTimeout: 1_000,
      enableOfflineQueue: false,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });

    this.client.on('error', (error) => {
      this.available = false;
      if (this.client?.status !== 'end') {
        this.logger.warn(
          `Redis cache error: ${
            error.message ||
            (error as Error & { code?: string }).code ||
            'connection failed'
          }`,
        );
      }
    });

    try {
      await this.client.connect();
      await this.client.ping();
      this.available = true;
    } catch (error) {
      this.available = false;
      this.client.disconnect();
      this.client = undefined;
      this.logger.warn(
        `Redis cache unavailable; continuing without cache: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async onModuleDestroy() {
    await this.client?.quit().catch(() => undefined);
  }

  async getJson<T>(key: string): Promise<T | null> {
    if (!this.isReady()) return null;

    const value = await this.client!.get(key).catch(() => null);
    if (!value) return null;

    try {
      return JSON.parse(value) as T;
    } catch {
      await this.del(key);
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlSeconds: number) {
    if (!this.isReady()) return;

    await this.client!.set(key, JSON.stringify(value), 'EX', ttlSeconds).catch(
      () => undefined,
    );
  }

  async remember<T>(
    key: string,
    ttlSeconds: number,
    factory: () => Promise<T>,
  ): Promise<T> {
    const cached = await this.getJson<T>(key);
    if (cached !== null) return cached;

    const value = await factory();
    await this.setJson(key, value, ttlSeconds);
    return value;
  }

  async del(...keys: string[]) {
    if (!this.isReady() || keys.length === 0) return 0;
    return this.client!.del(...keys).catch(() => 0);
  }

  async deleteByPattern(pattern: string) {
    if (!this.isReady()) return 0;

    let cursor = '0';
    let deleted = 0;
    do {
      const [nextCursor, keys] = await this.client!.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100,
      );
      cursor = nextCursor;
      if (keys.length > 0) deleted += await this.del(...keys);
    } while (cursor !== '0');

    return deleted;
  }

  getStatus(): 'ok' | 'degraded' | 'down' {
    if (this.config.get<string>('REDIS_CACHE_ENABLED') === 'false') {
      return 'degraded';
    }

    return this.isReady() ? 'ok' : 'down';
  }

  private isReady() {
    return this.available && this.client?.status === 'ready';
  }
}
