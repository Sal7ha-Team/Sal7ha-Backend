import { BadRequestException, Injectable } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { cacheKeys, CACHE_TTL_SECONDS } from 'src/common/cache/cache-keys';
import { RedisCacheService } from 'src/common/cache/redis-cache.service';
import { formatDate } from 'src/common/utils/date.util';
import { PrismaService } from 'src/prisma/prisma.service';
import type { DashboardWidgetPreferencesUpdateDto } from './dto/dashboard-widgets.dto';

const DASHBOARD_WIDGETS = [
  { id: 'profile', title: 'Profile', type: 'profile', span: 1 },
  { id: 'calendar', title: 'Calendar', type: 'calendar', span: 2 },
  {
    id: 'setup-warnings',
    title: 'Setup warnings',
    type: 'setupWarnings',
    span: 2,
  },
  {
    id: 'in-progress',
    title: 'In progress',
    type: 'status',
    statusKey: 'inProgress',
    color: '#3b82f6',
    span: 1,
  },
  {
    id: 'completed',
    title: 'Completed',
    type: 'status',
    statusKey: 'completed',
    color: '#10b981',
    span: 1,
  },
  {
    id: 'pending',
    title: 'Pending',
    type: 'status',
    statusKey: 'pending',
    color: '#f59e0b',
    span: 1,
  },
  {
    id: 'cancelled',
    title: 'Cancelled',
    type: 'status',
    statusKey: 'cancelled',
    color: '#ef4444',
    span: 1,
  },
] as const;

const DEFAULT_ACTIVE_WIDGET_IDS = [
  'profile',
  'calendar',
  'setup-warnings',
  'in-progress',
  'completed',
  'pending',
  'cancelled',
];

@Injectable()
export class DashboardService {
  constructor(
    private readonly cache: RedisCacheService,
    private readonly prisma: PrismaService,
  ) {}

  private requireBusiness(businessId: number | null | undefined): number {
    if (!businessId) throw new BadRequestException('No business context');
    return businessId;
  }

  async summary(businessId: number | null | undefined) {
    const id = this.requireBusiness(businessId);
    return this.cache.remember(
      cacheKeys.dashboardSummary(id),
      CACHE_TTL_SECONDS.dashboardSummary,
      () => this.computeSummary(id),
    );
  }

  private async computeSummary(id: number) {
    const grouped = await this.prisma.booking.groupBy({
      by: ['status'],
      where: { businessId: id },
      _count: { _all: true },
    });

    const base = {
      totalBookings: 0,
      inProgress: 0,
      completed: 0,
      pending: 0,
      cancelled: 0,
      accepted: 0,
    };

    for (const row of grouped) {
      const count = row._count._all;
      base.totalBookings += count;
      switch (row.status) {
        case BookingStatus.In_Progress:
          base.inProgress = count;
          break;
        case BookingStatus.Completed:
          base.completed = count;
          break;
        case BookingStatus.Pending:
          base.pending = count;
          break;
        case BookingStatus.Cancelled:
          base.cancelled = count;
          break;
        case BookingStatus.Accepted:
          base.accepted = count;
          break;
      }
    }
    return base;
  }

  async bookingsByMonth(
    businessId: number | null | undefined,
    year: number,
    month: number,
  ) {
    const id = this.requireBusiness(businessId);
    const start = new Date(Date.UTC(year, month, 1));
    const end = new Date(Date.UTC(year, month + 1, 1));

    const rows = await this.prisma.booking.findMany({
      where: {
        businessId: id,
        startDate: { gte: start, lt: end },
      },
      include: {
        service: true,
        customer: true,
        car: true,
        serviceDetails: true,
      },
      orderBy: { startDate: 'asc' },
    });

    return {
      year,
      month,
      bookings: rows.map((b) => ({
        id: b.id,
        serviceName: b.service.name,
        serviceIcon: b.service.icon,
        ownerIcon: null,
        name: `${b.customer.firstName} ${b.customer.lastName}`.trim(),
        carMake: b.car.make,
        carModel: b.car.model,
        carYear: b.car.year,
        startDate: formatDate(b.startDate),
        endDate: formatDate(b.endDate),
        status: b.status,
        price: Number(b.price),
        serviceDetails: b.serviceDetails.map((d) => ({
          label: d.label,
          value: d.value,
        })),
      })),
    };
  }

  async widgets(userId: number) {
    const preferences = await this.prisma.dashboardWidgetPreference.findUnique({
      where: { userId },
    });
    const activeIds = preferences?.activeWidgetIds ?? DEFAULT_ACTIVE_WIDGET_IDS;
    return this.serializeWidgets(activeIds);
  }

  async updateWidgets(
    userId: number,
    dto: DashboardWidgetPreferencesUpdateDto,
  ) {
    const activeWidgetIds = dto.activeWidgetIds.filter((id) =>
      DASHBOARD_WIDGETS.some((widget) => widget.id === id),
    );

    await this.prisma.dashboardWidgetPreference.upsert({
      where: { userId },
      create: { userId, activeWidgetIds },
      update: { activeWidgetIds },
    });

    return this.serializeWidgets(activeWidgetIds);
  }

  private serializeWidgets(activeIds: string[]) {
    const active = activeIds
      .map((id) => DASHBOARD_WIDGETS.find((widget) => widget.id === id))
      .filter((widget): widget is (typeof DASHBOARD_WIDGETS)[number] =>
        Boolean(widget),
      );
    const inactive = DASHBOARD_WIDGETS.filter(
      (widget) => !activeIds.includes(widget.id),
    );

    return {
      activeWidgets: active,
      inactiveWidgets: inactive,
    };
  }
}
