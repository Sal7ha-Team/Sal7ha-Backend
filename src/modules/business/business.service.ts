import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RedisCacheService } from 'src/common/cache/redis-cache.service';
import { cacheKeys, CACHE_TTL_SECONDS } from 'src/common/cache/cache-keys';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  BusinessServiceCreateDto,
  BusinessServiceDto,
  BusinessServiceQueryDto,
  BusinessServiceUpdateDto,
} from './dto/business-service.dto';
import { BusinessProfileDto } from './dto/business-profile.dto';

@Injectable()
export class BusinessService {
  constructor(
    private readonly cache: RedisCacheService,
    private readonly prisma: PrismaService,
  ) {}

  private requireBusiness(businessId: number | null | undefined): number {
    if (!businessId) throw new BadRequestException('No business context');
    return businessId;
  }

  async getProfile(businessId: number | null | undefined) {
    const id = this.requireBusiness(businessId);
    const b = await this.prisma.business.findUnique({ where: { id } });
    if (!b) throw new NotFoundException('Business not found');
    return {
      id: String(b.id),
      name: b.name,
      phoneNumber: b.phoneNumber,
      email: b.email,
      commercialRegistrationNumber: Number(b.commercialRegistraionNumber),
      commercialRegistraionNumber: Number(b.commercialRegistraionNumber),
      taxIdentificationNumber: Number(b.taxIdentificationNumber),
      businessType: b.businessType,
      employeeCount: b.employeeCount,
      address: {
        country: b.country,
        streetAddress: b.streetAddress,
        city: b.city,
        state: b.state,
        zipCode: b.zipCode,
      },
      location: {
        country: b.country,
        streetAddress: b.streetAddress,
        city: b.city,
        state: b.state,
        zipCode: b.zipCode,
      },
      workingHours: {
        open: b.workingHoursOpen,
        close: b.workingHoursClose,
      },
      onboardingCompleted: b.onboardingCompleted,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    };
  }

  async updateProfile(
    businessId: number | null | undefined,
    dto: BusinessProfileDto,
  ) {
    const id = this.requireBusiness(businessId);
    await this.prisma.business.update({
      where: { id },
      data: {
        name: dto.name,
        phoneNumber: dto.phoneNumber,
        email: dto.email,
        commercialRegistraionNumber:
          dto.commercialRegistrationNumber !== undefined ||
          dto.commercialRegistraionNumber !== undefined
            ? BigInt(
                dto.commercialRegistrationNumber ??
                  dto.commercialRegistraionNumber!,
              )
            : undefined,
        taxIdentificationNumber:
          dto.taxIdentificationNumber !== undefined
            ? BigInt(dto.taxIdentificationNumber)
            : undefined,
        businessType: dto.businessType,
        employeeCount: dto.employeeCount,
        country: (dto.address ?? dto.location)?.country,
        streetAddress: (dto.address ?? dto.location)?.streetAddress,
        city: (dto.address ?? dto.location)?.city,
        state: (dto.address ?? dto.location)?.state,
        zipCode: (dto.address ?? dto.location)?.zipCode,
        workingHoursOpen: dto.workingHours?.open,
        workingHoursClose: dto.workingHours?.close,
      },
    });
    await this.invalidateBusinessCache(id);
    return this.getProfile(id);
  }

  async getSetupWarnings(businessId: number | null | undefined) {
    const id = this.requireBusiness(businessId);
    return this.cache.remember(
      cacheKeys.setupWarnings(id),
      CACHE_TTL_SECONDS.setupWarnings,
      () => this.computeSetupWarnings(id),
    );
  }

  async getServices(
    businessId: number | null | undefined,
    query: BusinessServiceQueryDto = {},
  ) {
    const id = this.requireBusiness(businessId);
    const rows = await this.prisma.businessService.findMany({
      where: { businessId: id, category: query.category, status: query.status },
      include: { service: { include: { category: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.serializeBusinessService(row));
  }

  async replaceServices(
    businessId: number | null | undefined,
    items: BusinessServiceDto[],
  ) {
    const id = this.requireBusiness(businessId);
    await this.prisma.$transaction(async (tx) => {
      await tx.businessService.deleteMany({ where: { businessId: id } });
      for (const it of items) {
        if (!it.serviceId) continue;
        const service = await tx.service.findUnique({
          where: { id: it.serviceId },
          include: { category: true },
        });
        await tx.businessService.create({
          data: {
            businessId: id,
            serviceId: it.serviceId,
            category: service?.category.name,
            name: service?.name,
            price: it.priceMin ?? it.priceMax ?? 0,
            priceMin: it.priceMin ?? null,
            priceMax: it.priceMax ?? null,
            enabled: it.enabled ?? true,
            status: it.enabled === false ? 'inactive' : 'active',
          },
        });
      }
    });
    await this.invalidateBusinessCache(id);
    return this.getServices(id);
  }

  async createService(
    businessId: number | null | undefined,
    dto: BusinessServiceCreateDto,
  ) {
    const id = this.requireBusiness(businessId);
    const row = await this.prisma.businessService.create({
      data: {
        businessId: id,
        serviceId: dto.serviceId ?? null,
        category: dto.category,
        name: dto.name,
        price: dto.price,
        currency: dto.currency ?? 'USD',
        status: dto.status ?? 'active',
        enabled: dto.status !== 'inactive',
        priceMin: dto.price,
        priceMax: dto.price,
      },
      include: { service: { include: { category: true } } },
    });
    await this.invalidateBusinessCache(id);
    return this.serializeBusinessService(row);
  }

  async updateService(
    businessId: number | null | undefined,
    serviceId: string,
    dto: BusinessServiceUpdateDto,
  ) {
    const id = this.requireBusiness(businessId);
    await this.requireBusinessService(id, serviceId);
    const row = await this.prisma.businessService.update({
      where: { id: Number(serviceId) },
      data: {
        serviceId: dto.serviceId,
        category: dto.category,
        name: dto.name,
        price: dto.price,
        currency: dto.currency,
        status: dto.status,
        enabled: dto.status ? dto.status !== 'inactive' : undefined,
        priceMin: dto.price,
        priceMax: dto.price,
      },
      include: { service: { include: { category: true } } },
    });
    await this.invalidateBusinessCache(id);
    return this.serializeBusinessService(row);
  }

  async deleteService(
    businessId: number | null | undefined,
    serviceId: string,
  ) {
    const id = this.requireBusiness(businessId);
    await this.requireBusinessService(id, serviceId);
    await this.prisma.businessService.delete({
      where: { id: Number(serviceId) },
    });
    await this.invalidateBusinessCache(id);
  }

  private async computeSetupWarnings(businessId: number) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      include: {
        bankDetails: true,
        billingAccounts: { take: 1 },
        businessInventory: { take: 1 },
        businessServices: { take: 1 },
        users: { take: 10 },
      },
    });
    if (!business) throw new NotFoundException('Business not found');

    const warnings: Array<{
      id: string;
      title: string;
      description: string;
      segment:
        | 'billing'
        | 'personal'
        | 'security'
        | 'business'
        | 'services'
        | 'inventory';
      severity: 'warning' | 'critical';
    }> = [];

    if (
      !business.name ||
      !business.email ||
      !business.phoneNumber ||
      !business.country ||
      !business.city
    ) {
      warnings.push({
        id: 'business-profile-incomplete',
        title: 'Complete business profile',
        description: 'Add business contact and address details.',
        segment: 'business',
        severity: 'warning',
      });
    }

    if (!business.workingHoursOpen || !business.workingHoursClose) {
      warnings.push({
        id: 'working-hours-missing',
        title: 'Add working hours',
        description: 'Set shop opening and closing hours.',
        segment: 'business',
        severity: 'warning',
      });
    }

    if (!business.bankDetails && business.billingAccounts.length === 0) {
      warnings.push({
        id: 'billing-account-missing',
        title: 'Add billing account',
        description: 'Add bank details before accepting paid bookings.',
        segment: 'billing',
        severity: 'critical',
      });
    }

    if (business.businessServices.length === 0) {
      warnings.push({
        id: 'services-missing',
        title: 'Select services',
        description: 'Choose at least one service your shop provides.',
        segment: 'services',
        severity: 'critical',
      });
    }

    if (business.businessInventory.length === 0) {
      warnings.push({
        id: 'inventory-missing',
        title: 'Add inventory coverage',
        description: 'Add service inventory so storage reports are useful.',
        segment: 'inventory',
        severity: 'warning',
      });
    }

    if (!business.users.some((user) => user.twoFactorEnabled)) {
      warnings.push({
        id: 'mfa-disabled',
        title: 'Enable multi-factor authentication',
        description: 'Protect business access with a second factor.',
        segment: 'security',
        severity: 'warning',
      });
    }

    return warnings;
  }

  private async invalidateBusinessCache(businessId: number) {
    await this.cache.del(
      cacheKeys.setupWarnings(businessId),
      cacheKeys.dashboardSummary(businessId),
    );
  }

  private async requireBusinessService(businessId: number, serviceId: string) {
    const row = await this.prisma.businessService.findFirst({
      where: { id: Number(serviceId), businessId },
    });
    if (!row) throw new NotFoundException('Business service not found');
    return row;
  }

  private serializeBusinessService(row: {
    id: number;
    businessId: number;
    serviceId: string | null;
    category: string | null;
    name: string | null;
    price: unknown;
    priceMin: unknown;
    priceMax: unknown;
    currency: string;
    status: string;
    enabled: boolean;
    createdAt: Date;
    updatedAt: Date;
    service?: { name: string; category?: { name: string } | null } | null;
  }) {
    const price =
      row.price ?? row.priceMin ?? row.priceMax ?? (row.enabled ? 0 : 0);
    return {
      id: String(row.id),
      businessId: String(row.businessId),
      serviceId: row.serviceId,
      category: row.category ?? row.service?.category?.name ?? '',
      name: row.name ?? row.service?.name ?? '',
      price: Number(price),
      currency: row.currency,
      status: row.status ?? (row.enabled ? 'active' : 'inactive'),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
