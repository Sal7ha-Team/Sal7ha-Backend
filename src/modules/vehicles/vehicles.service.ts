import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { pagination, paginationMeta } from 'src/common/utils/pagination.util';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  VehicleCreateDto,
  VehicleQueryDto,
  VehicleUpdateDto,
} from './dto/vehicle.dto';

type VehicleRecord = Prisma.CarGetPayload<{ include: { customer: true } }>;

@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  private requireBusiness(businessId: number | null | undefined) {
    if (!businessId) throw new BadRequestException('No business context');
    return businessId;
  }

  async list(businessId: number | null | undefined, query: VehicleQueryDto) {
    const bid = this.requireBusiness(businessId);
    const page = pagination(query);
    const where: Prisma.CarWhereInput = {
      customer: { businessId: bid },
      customerId: query.customerId ? Number(query.customerId) : undefined,
    };
    if (query.search) {
      where.OR = [
        { make: { contains: query.search, mode: 'insensitive' } },
        { model: { contains: query.search, mode: 'insensitive' } },
        { plate: { contains: query.search, mode: 'insensitive' } },
        { vin: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.car.count({ where }),
      this.prisma.car.findMany({
        where,
        include: { customer: true },
        orderBy: { createdAt: 'desc' },
        skip: page.skip,
        take: page.take,
      }),
    ]);
    return {
      data: rows.map((row) => this.serialize(row)),
      pagination: paginationMeta(total, page.page, page.limit),
    };
  }

  async create(businessId: number | null | undefined, dto: VehicleCreateDto) {
    const bid = this.requireBusiness(businessId);
    const customer = await this.prisma.customer.findFirst({
      where: { id: Number(dto.customerId), businessId: bid },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const row = await this.prisma.car.create({
      data: {
        customerId: customer.id,
        make: dto.make,
        model: dto.model,
        year: dto.year,
        plate: dto.plate,
        vin: dto.vin,
      },
      include: { customer: true },
    });
    return this.serialize(row);
  }

  async get(businessId: number | null | undefined, id: string) {
    const row = await this.prisma.car.findFirst({
      where: {
        id: Number(id),
        customer: { businessId: this.requireBusiness(businessId) },
      },
      include: { customer: true },
    });
    if (!row) throw new NotFoundException('Vehicle not found');
    return this.serialize(row);
  }

  async update(
    businessId: number | null | undefined,
    id: string,
    dto: VehicleUpdateDto,
  ) {
    const bid = this.requireBusiness(businessId);
    await this.get(bid, id);
    if (dto.customerId) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: Number(dto.customerId), businessId: bid },
      });
      if (!customer) throw new NotFoundException('Customer not found');
    }
    const row = await this.prisma.car.update({
      where: { id: Number(id) },
      data: {
        customerId: dto.customerId ? Number(dto.customerId) : undefined,
        make: dto.make,
        model: dto.model,
        year: dto.year,
        plate: dto.plate,
        vin: dto.vin,
      },
      include: { customer: true },
    });
    return this.serialize(row);
  }

  private serialize(row: VehicleRecord) {
    return {
      id: String(row.id),
      customerId: String(row.customerId),
      make: row.make,
      model: row.model,
      year: row.year,
      plate: row.plate,
      vin: row.vin,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
