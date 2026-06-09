import { Injectable } from '@nestjs/common';
import { RedisCacheService } from 'src/common/cache/redis-cache.service';
import { PrismaService } from 'src/prisma/prisma.service';

type DependencyStatus = 'ok' | 'degraded' | 'down';

@Injectable()
export class SystemService {
  constructor(
    private readonly cache: RedisCacheService,
    private readonly prisma: PrismaService,
  ) {}

  async health() {
    const database = await this.getDatabaseStatus();
    const redis = this.cache.getStatus();

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version,
      redis,
      database,
      queues: redis === 'ok' ? 'ok' : 'down',
    };
  }

  private async getDatabaseStatus(): Promise<DependencyStatus> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'ok';
    } catch {
      return 'down';
    }
  }
}
