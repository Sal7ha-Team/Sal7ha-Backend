import { Injectable } from '@nestjs/common';
import { RedisCacheService } from 'src/common/cache/redis-cache.service';
import { cacheKeys, CACHE_TTL_SECONDS } from 'src/common/cache/cache-keys';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ServicesService {
  constructor(
    private readonly cache: RedisCacheService,
    private readonly prisma: PrismaService,
  ) {}

  async catalog() {
    return this.cache.remember(
      cacheKeys.servicesCatalog(),
      CACHE_TTL_SECONDS.servicesCatalog,
      () => this.getCatalog(),
    );
  }

  private async getCatalog() {
    const [categories, services, options] = await Promise.all([
      this.prisma.serviceCategory.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.service.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.serviceConfigOption.findMany(),
    ]);

    return categories.map((cat) => {
      const configOptions: Record<string, string[]> = {};
      for (const opt of options.filter((o) => o.categoryId === cat.id)) {
        (configOptions[opt.configKey] ??= []).push(opt.value);
      }
      return {
        id: cat.id,
        name: cat.name,
        icon: null,
        services: services
          .filter((s) => s.categoryId === cat.id)
          .map((s) => ({
            id: s.id,
            name: s.name,
            categoryId: s.categoryId,
            category: cat.name,
            icon: s.icon,
          })),
        configOptions: Object.entries(configOptions).map(([key, values]) => ({
          key,
          label: key,
          options: values,
        })),
      };
    });
  }
}
