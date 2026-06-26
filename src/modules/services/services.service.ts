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

  async categories() {
    const categories = await this.prisma.serviceCategory.findMany({
      orderBy: { name: 'asc' },
    });
    return categories.map((category) => ({
      id: category.id,
      name: category.name,
      nameAr: null,
      iconKey: category.id,
    }));
  }

  async services(query: { q?: string; categoryId?: string } = {}) {
    const rows = await this.prisma.service.findMany({
      where: {
        categoryId: query.categoryId,
        name: query.q ? { contains: query.q, mode: 'insensitive' } : undefined,
      },
      include: { category: true },
      orderBy: { name: 'asc' },
    });
    return rows.map((row) => this.serializeMobileService(row));
  }

  async service(id: string) {
    const row = await this.prisma.service.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!row) return null;
    return this.serializeMobileService(row);
  }

  oilBrands() {
    return [
      { id: 'mobil-1', name: 'Mobil 1', logo: null },
      { id: 'shell-helix', name: 'Shell Helix', logo: null },
      { id: 'castrol-edge', name: 'Castrol EDGE', logo: null },
      { id: 'total-quartz', name: 'Total Quartz', logo: null },
    ];
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

  private serializeMobileService(row: {
    id: string;
    name: string;
    icon: string | null;
    category: { id: string; name: string };
  }) {
    return {
      id: row.id,
      category: {
        id: row.category.id,
        name: row.category.name,
        nameAr: null,
        iconKey: row.icon,
      },
      name: row.name,
      nameAr: null,
      description: null,
      priceRange: {
        min: null,
        max: null,
        currency: 'EGP',
      },
      durationMinutes: null,
    };
  }
}
