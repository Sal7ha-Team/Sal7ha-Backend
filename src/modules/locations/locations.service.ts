import { Injectable } from '@nestjs/common';
import { RedisCacheService } from 'src/common/cache/redis-cache.service';
import { cacheKeys, CACHE_TTL_SECONDS } from 'src/common/cache/cache-keys';
import { LocationSearchDto, NearbyDto } from './dto/locations.dto';

@Injectable()
export class LocationsService {
  constructor(private readonly cache: RedisCacheService) {}

  async search(query: LocationSearchDto) {
    return this.cache.remember(
      cacheKeys.geoSearch(query.query, query.limit),
      CACHE_TTL_SECONDS.geoSearch,
      async () => this.localSearch(query),
    );
  }

  async nearby(query: NearbyDto) {
    return this.cache.remember(
      cacheKeys.geoNearby(query.lat, query.lng, query.radiusMeters),
      CACHE_TTL_SECONDS.geoNearby,
      async () => [
        {
          id: 1,
          lat: query.lat + 0.002,
          lng: query.lng + 0.002,
          name: 'Nearest service area',
          category: 'automotive',
        },
        {
          id: 2,
          lat: query.lat - 0.002,
          lng: query.lng - 0.001,
          name: 'Nearby fuel station',
          category: 'fuel',
        },
      ],
    );
  }

  private localSearch(query: LocationSearchDto) {
    const seed = [...query.query].reduce(
      (sum, char) => sum + char.charCodeAt(0),
      0,
    );
    const baseLat = 30.0444 + (seed % 100) / 10_000;
    const baseLng = 31.2357 + (seed % 100) / 10_000;
    return Array.from({ length: query.limit }, (_, index) => ({
      placeId: seed + index,
      displayName: `${query.query} ${index + 1}`,
      lat: Number((baseLat + index / 1_000).toFixed(6)),
      lng: Number((baseLng + index / 1_000).toFixed(6)),
      type: index === 0 ? 'city' : 'address',
      address: {
        country: 'Egypt',
        city: query.query,
      },
    }));
  }
}
