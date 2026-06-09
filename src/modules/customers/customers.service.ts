import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { pagination, paginationMeta } from 'src/common/utils/pagination.util';
import {
  CustomerCreateDto,
  CustomerQueryDto,
  CustomerUpdateDto,
} from './dto/customer.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  private requireBusiness(businessId: number | null | undefined) {
    if (!businessId) throw new BadRequestException('No business context');
    return businessId;
  }

  async list(businessId: number | null | undefined, query: CustomerQueryDto) {
    const bid = this.requireBusiness(businessId);
    const page = pagination(query);
    const where = {
      businessId: bid,
      ...(query.search
        ? {
            OR: [
              {
                firstName: {
                  contains: query.search,
                  mode: 'insensitive' as const,
                },
              },
              {
                lastName: {
                  contains: query.search,
                  mode: 'insensitive' as const,
                },
              },
              {
                email: { contains: query.search, mode: 'insensitive' as const },
              },
              {
                phoneNumber: {
                  contains: query.search,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
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

  async create(businessId: number | null | undefined, dto: CustomerCreateDto) {
    const row = await this.prisma.customer.create({
      data: { businessId: this.requireBusiness(businessId), ...dto },
    });
    return this.serialize(row);
  }

  async get(businessId: number | null | undefined, id: string) {
    const row = await this.prisma.customer.findFirst({
      where: { id: Number(id), businessId: this.requireBusiness(businessId) },
    });
    if (!row) throw new NotFoundException('Customer not found');
    return this.serialize(row);
  }

  async update(
    businessId: number | null | undefined,
    id: string,
    dto: CustomerUpdateDto,
  ) {
    await this.get(businessId, id);
    const row = await this.prisma.customer.update({
      where: { id: Number(id) },
      data: dto,
    });
    return this.serialize(row);
  }

  private serialize(row: {
    id: number;
    businessId: number;
    firstName: string;
    lastName: string;
    email: string | null;
    phoneNumber: string | null;
    avatarUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: String(row.id),
      businessId: String(row.businessId),
      firstName: row.firstName,
      lastName: row.lastName,
      displayName: `${row.firstName} ${row.lastName}`.trim(),
      email: row.email,
      phoneNumber: row.phoneNumber,
      avatarUrl: row.avatarUrl,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
