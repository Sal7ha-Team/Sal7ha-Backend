import { ConfigService } from '@nestjs/config';
import type { RedisOptions } from 'ioredis';

export function redisConnectionOptions(config: ConfigService): RedisOptions {
  const redisUrl = config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
  const parsed = new URL(redisUrl);

  return {
    db: parsed.pathname ? Number(parsed.pathname.slice(1)) || 0 : 0,
    host: parsed.hostname,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    port: parsed.port ? Number(parsed.port) : 6379,
    username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
  };
}
