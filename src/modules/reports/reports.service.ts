import { BadRequestException, Injectable } from '@nestjs/common';
import { RedisCacheService } from 'src/common/cache/redis-cache.service';
import { cacheKeys, CACHE_TTL_SECONDS } from 'src/common/cache/cache-keys';
import { PrismaService } from 'src/prisma/prisma.service';
import { ApplicationStatsQueryDto } from './dto/reports.dto';

@Injectable()
export class ReportsService {
  constructor(
    private readonly cache: RedisCacheService,
    private readonly prisma: PrismaService,
  ) {}

  private requireBusiness(businessId: number | null | undefined) {
    if (!businessId) throw new BadRequestException('No business context');
    return businessId;
  }

  async applicationStats(
    businessId: number | null | undefined,
    query: ApplicationStatsQueryDto,
  ) {
    const bid = this.requireBusiness(businessId);
    return this.cache.remember(
      cacheKeys.applicationStats(
        bid,
        query.period,
        query.startDate,
        query.endDate,
      ),
      CACHE_TTL_SECONDS.applicationStats,
      () => this.compute(bid, query),
    );
  }

  private async compute(businessId: number, query: ApplicationStatsQueryDto) {
    const range = this.range(query);
    const [customers, bookings, revenue, cars, servicePayments, itemPayments] =
      await Promise.all([
        this.prisma.customer.count({ where: { businessId } }),
        this.prisma.booking.count({ where: { businessId } }),
        this.prisma.payment.aggregate({
          where: { businessId, date: { gte: range.start, lte: range.end } },
          _sum: { amount: true },
        }),
        this.prisma.car.count({ where: { customer: { businessId } } }),
        this.prisma.payment.groupBy({
          by: ['item'],
          where: { businessId, kind: 'service' },
          _sum: { amount: true },
          _count: { _all: true },
          orderBy: { _sum: { amount: 'desc' } },
          take: 8,
        }),
        this.prisma.payment.groupBy({
          by: ['item'],
          where: { businessId, kind: 'item' },
          _sum: { amount: true },
          _count: { _all: true },
          orderBy: { _sum: { amount: 'desc' } },
          take: 8,
        }),
      ]);
    return {
      period: query.period,
      rangeLabel: `${range.start.toISOString().slice(0, 10)} - ${range.end
        .toISOString()
        .slice(0, 10)}`,
      axisLabels: this.axisLabels(query.period),
      stats: [
        {
          key: 'customers',
          label: 'Customers',
          value: customers,
          icon: 'customers',
          delta: 0,
        },
        {
          key: 'bookings',
          label: 'Bookings',
          value: bookings,
          icon: 'bookings',
          delta: 0,
        },
        {
          key: 'revenue',
          label: 'Revenue',
          value: Number(revenue._sum.amount ?? 0),
          icon: 'revenue',
          delta: 0,
        },
        { key: 'cars', label: 'Cars', value: cars, icon: 'cars', delta: 0 },
      ],
      services: servicePayments.map((row) => ({
        key: row.item,
        label: row.item,
        profit: [Number(row._sum.amount ?? 0)],
        units: row._count._all,
        delta: 0,
      })),
      items: itemPayments.map((row) => ({
        key: row.item,
        label: row.item,
        profit: [Number(row._sum.amount ?? 0)],
        units: row._count._all,
        delta: 0,
      })),
    };
  }

  private range(query: ApplicationStatsQueryDto) {
    const end = query.endDate ? new Date(query.endDate) : new Date();
    const start = query.startDate ? new Date(query.startDate) : new Date(end);
    if (!query.startDate) {
      if (query.period === 'week') start.setUTCDate(end.getUTCDate() - 6);
      if (query.period === 'month') start.setUTCMonth(end.getUTCMonth() - 1);
      if (query.period === 'year')
        start.setUTCFullYear(end.getUTCFullYear() - 1);
    }
    return { start, end };
  }

  private axisLabels(period: ApplicationStatsQueryDto['period']) {
    if (period === 'week')
      return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    if (period === 'month') return ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
    return [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
  }
}
