import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, BookingStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { RedisCacheService } from 'src/common/cache/redis-cache.service';
import { cacheKeys } from 'src/common/cache/cache-keys';
import { AppQueueService } from 'src/common/queues/app-queue.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { formatDate, parseDate } from 'src/common/utils/date.util';
import {
  ApiBookingStatus,
  BookingQueryDto,
  SortOrder,
} from './dto/booking-query.dto';
import {
  BatchStatusDto,
  BookingCreateDto,
  BookingUpdateDto,
} from './dto/booking.dto';

type BookingRecord = Prisma.BookingGetPayload<{
  include: {
    service: true;
    customer: true;
    car: true;
    serviceDetails: true;
  };
}>;

@Injectable()
export class BookingsService {
  constructor(
    private readonly cache: RedisCacheService,
    private readonly queues: AppQueueService,
    private readonly prisma: PrismaService,
  ) {}

  private requireBusiness(businessId: number | null | undefined): number {
    if (!businessId) throw new BadRequestException('No business context');
    return businessId;
  }

  private serialize(b: BookingRecord) {
    return {
      id: b.id,
      businessId: String(b.businessId),
      customerId: String(b.customerId),
      vehicleId: String(b.carId),
      serviceId: b.serviceId,
      serviceName: b.service.name,
      serviceIcon: b.service.icon,
      ownerIcon: null as string | null,
      name: `${b.customer.firstName} ${b.customer.lastName}`.trim(),
      carMake: b.car.make,
      carModel: b.car.model,
      carYear: b.car.year,
      startDate: formatDate(b.startDate),
      endDate: formatDate(b.endDate),
      status: this.toApiStatus(b.status),
      price: Number(b.price),
      currency: 'USD',
      serviceDetails: b.serviceDetails.map((d) => ({
        label: d.label,
        value: d.value,
      })),
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    };
  }

  async list(businessId: number | null | undefined, q: BookingQueryDto) {
    const id = this.requireBusiness(businessId);

    const where: Prisma.BookingWhereInput = { businessId: id };
    if (q.status) where.status = this.toPrismaStatus(q.status);
    if (q.startDate) where.startDate = { gte: parseDate(q.startDate) };
    if (q.endDate)
      where.endDate = {
        ...(where.endDate as object),
        lte: parseDate(q.endDate),
      };
    if (q.search) {
      where.OR = [
        { id: { contains: q.search, mode: 'insensitive' } },
        { service: { name: { contains: q.search, mode: 'insensitive' } } },
        { car: { make: { contains: q.search, mode: 'insensitive' } } },
      ];
    }

    const orderBy: Prisma.BookingOrderByWithRelationInput = (() => {
      const dir = q.sortOrder ?? SortOrder.asc;
      switch (q.sortBy) {
        case 'serviceName':
          return { service: { name: dir } };
        case 'name':
          return { customer: { firstName: dir } };
        case 'carMake':
          return { car: { make: dir } };
        case 'status':
          return { status: dir };
        case 'price':
          return { price: dir };
        case 'endDate':
          return { endDate: dir };
        case 'startDate':
        default:
          return { startDate: dir };
      }
    })();

    const page = q.page ?? 1;
    const limit = q.limit ?? 10;

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.booking.count({ where }),
      this.prisma.booking.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          service: true,
          customer: true,
          car: true,
          serviceDetails: true,
        },
      }),
    ]);

    return {
      data: rows.map((r) => this.serialize(r)),
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async get(businessId: number | null | undefined, id: string) {
    const bid = this.requireBusiness(businessId);
    const booking = await this.prisma.booking.findFirst({
      where: { id, businessId: bid },
      include: {
        service: true,
        customer: true,
        car: true,
        serviceDetails: true,
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    return this.serialize(booking);
  }

  async create(businessId: number | null | undefined, dto: BookingCreateDto) {
    const bid = this.requireBusiness(businessId);

    const customer = await this.prisma.customer.findFirst({
      where: { id: Number(dto.customerId), businessId: bid },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const car = dto.vehicleId
      ? await this.prisma.car.findFirst({
          where: { id: Number(dto.vehicleId), customer: { businessId: bid } },
        })
      : await this.prisma.car.create({
          data: {
            customerId: customer.id,
            make: dto.carMake ?? '',
            model: dto.carModel ?? '',
            year: dto.carYear ?? '',
          },
        });
    if (!car) throw new NotFoundException('Vehicle not found');

    const booking = await this.prisma.booking.create({
      data: {
        id: `BK-${randomUUID().slice(0, 8).toUpperCase()}`,
        businessId: bid,
        customerId: customer.id,
        carId: car.id,
        serviceId: dto.serviceId,
        startDate: parseDate(dto.startDate),
        endDate: parseDate(dto.endDate),
        price: dto.price ?? 0,
        status: dto.status
          ? this.toPrismaStatus(dto.status)
          : BookingStatus.Pending,
        serviceDetails: dto.serviceDetails
          ? {
              create: dto.serviceDetails.map((d) => ({
                label: d.label,
                value: d.value,
              })),
            }
          : undefined,
      },
      include: {
        service: true,
        customer: true,
        car: true,
        serviceDetails: true,
      },
    });
    await this.invalidateReadModels(bid);
    return this.serialize(booking);
  }

  async update(
    businessId: number | null | undefined,
    id: string,
    dto: BookingUpdateDto,
  ) {
    const bid = this.requireBusiness(businessId);
    const existing = await this.prisma.booking.findFirst({
      where: { id, businessId: bid },
    });
    if (!existing) throw new NotFoundException('Booking not found');
    if (dto.customerId) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: Number(dto.customerId), businessId: bid },
      });
      if (!customer) throw new NotFoundException('Customer not found');
    }
    if (dto.vehicleId) {
      const vehicle = await this.prisma.car.findFirst({
        where: { id: Number(dto.vehicleId), customer: { businessId: bid } },
      });
      if (!vehicle) throw new NotFoundException('Vehicle not found');
    }

    const updated = await this.prisma.booking.update({
      where: { id },
      data: {
        serviceId: dto.serviceId,
        customerId: dto.customerId ? Number(dto.customerId) : undefined,
        carId: dto.vehicleId ? Number(dto.vehicleId) : undefined,
        status: dto.status ? this.toPrismaStatus(dto.status) : undefined,
        startDate: dto.startDate ? parseDate(dto.startDate) : undefined,
        endDate: dto.endDate ? parseDate(dto.endDate) : undefined,
        price: dto.price,
        serviceDetails: dto.serviceDetails
          ? {
              deleteMany: {},
              create: dto.serviceDetails.map((d) => ({
                label: d.label,
                value: d.value,
              })),
            }
          : undefined,
      },
      include: {
        service: true,
        customer: true,
        car: true,
        serviceDetails: true,
      },
    });
    await this.invalidateReadModels(bid);
    return this.serialize(updated);
  }

  async remove(businessId: number | null | undefined, id: string) {
    const bid = this.requireBusiness(businessId);
    const existing = await this.prisma.booking.findFirst({
      where: { id, businessId: bid },
    });
    if (!existing) throw new NotFoundException('Booking not found');
    await this.prisma.booking.delete({ where: { id } });
    await this.invalidateReadModels(bid);
  }

  async setStatus(
    businessId: number | null | undefined,
    id: string,
    status: ApiBookingStatus,
  ) {
    const updated = await this.update(businessId, id, { status });
    const bid = this.requireBusiness(businessId);
    await this.queues.enqueueBookingStatusNotifications({
      businessId: bid,
      bookingIds: [id],
      status: this.toPrismaStatus(status),
    });
    return updated;
  }

  async batchStatus(
    businessId: number | null | undefined,
    dto: BatchStatusDto,
  ) {
    const bid = this.requireBusiness(businessId);
    const result = await this.prisma.booking.updateMany({
      where: { id: { in: dto.ids }, businessId: bid },
      data: { status: this.toPrismaStatus(dto.status) },
    });
    await this.invalidateReadModels(bid);
    await this.queues.enqueueBookingStatusNotifications({
      businessId: bid,
      bookingIds: dto.ids,
      status: this.toPrismaStatus(dto.status),
    });

    return {
      requested: dto.ids.length,
      succeeded: result.count,
      failed: dto.ids.length - result.count,
      failedIds: result.count === dto.ids.length ? [] : undefined,
    };
  }

  private toApiStatus(status: BookingStatus) {
    return status === BookingStatus.In_Progress ? 'In-Progress' : status;
  }

  private toPrismaStatus(status: ApiBookingStatus | BookingStatus) {
    return status === ApiBookingStatus.InProgress
      ? BookingStatus.In_Progress
      : (status as BookingStatus);
  }

  private async invalidateReadModels(businessId: number) {
    await this.cache.del(
      cacheKeys.dashboardSummary(businessId),
      cacheKeys.setupWarnings(businessId),
    );
  }
}
