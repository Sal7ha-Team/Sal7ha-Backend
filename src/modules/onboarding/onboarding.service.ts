import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { BusinessType, EmployeeCount, TwoFactorMethod } from '@prisma/client';
import { RedisCacheService } from 'src/common/cache/redis-cache.service';
import { cacheKeys } from 'src/common/cache/cache-keys';
import { PrismaService } from 'src/prisma/prisma.service';
import { OwnerInformationDto } from './dto/owner-information.dto';
import {
  BusinessInformationDto,
  BusinessTypeInput,
  EmployeeCountInput,
} from './dto/business-information.dto';
import { BuildBusinessDto } from './dto/build-business.dto';
import { BankDetailsDto } from './dto/bank-details.dto';
import { TwoFactorAuthDto, TwoFactorMethodInput } from './dto/two-factor.dto';

const STEPS = [
  'owner-information',
  'business-information',
  'build-business',
  'bank-details',
  'two-factor-auth',
] as const;
type Step = (typeof STEPS)[number];

const BUSINESS_TYPE_MAP: Record<BusinessTypeInput, BusinessType> = {
  [BusinessTypeInput.general_repair]: BusinessType.general_repair,
  [BusinessTypeInput.specialized]: BusinessType.specialized,
  [BusinessTypeInput.body_paint]: BusinessType.body_paint,
  [BusinessTypeInput.quick_service]: BusinessType.quick_service,
};

const EMPLOYEE_COUNT_MAP: Record<EmployeeCountInput, EmployeeCount> = {
  [EmployeeCountInput.small]: EmployeeCount.small,
  [EmployeeCountInput.medium]: EmployeeCount.medium,
  [EmployeeCountInput.large]: EmployeeCount.large,
};

const TWO_FACTOR_MAP: Record<TwoFactorMethodInput, TwoFactorMethod> = {
  [TwoFactorMethodInput.sms]: TwoFactorMethod.sms,
  [TwoFactorMethodInput.authenticator]: TwoFactorMethod.authenticator,
};

@Injectable()
export class OnboardingService {
  constructor(
    private readonly cache: RedisCacheService,
    private readonly prisma: PrismaService,
  ) {}

  private requireBusinessId(businessId: number | null | undefined): number {
    if (!businessId) {
      throw new BadRequestException('User is not linked to a business');
    }
    return businessId;
  }

  private async computeProgress(businessId: number) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      include: {
        bankDetails: true,
        businessServices: { take: 1 },
        users: { take: 10 },
      },
    });
    if (!business) throw new BadRequestException('Business not found');

    const completed: Step[] = [];
    if (business.users.length > 0) completed.push('owner-information');
    if (business.businessType && business.employeeCount)
      completed.push('business-information');
    if (business.businessServices.length > 0 && business.workingHoursOpen)
      completed.push('build-business');
    if (business.bankDetails) completed.push('bank-details');
    if (business.users.some((user) => user.twoFactorEnabled)) {
      completed.push('two-factor-auth');
    }

    const nextStep = STEPS.find((s) => !completed.includes(s)) ?? null;
    const submitted = business.onboardingCompleted;
    const percent = submitted
      ? 100
      : Math.round((completed.length / STEPS.length) * 100);
    return {
      currentStep: submitted ? 'submitted' : (nextStep ?? 'review'),
      completedSteps: completed,
      percent,
      nextStep,
      submitted,
      missingRequirements: STEPS.filter((s) => !completed.includes(s)),
    };
  }

  async getProgress(businessId: number | null | undefined) {
    const id = this.requireBusinessId(businessId);
    const {
      currentStep,
      completedSteps,
      percent,
      submitted,
      missingRequirements,
    } = await this.computeProgress(id);
    return {
      currentStep,
      completedSteps,
      percent,
      submitted,
      missingRequirements,
    };
  }

  private async stepResponse(businessId: number) {
    const { nextStep } = await this.computeProgress(businessId);
    if (!nextStep) {
      await this.prisma.business.update({
        where: { id: businessId },
        data: { onboardingCompleted: true },
      });
      await this.prisma.user.updateMany({
        where: { businessId },
        data: { onboardingCompleted: true },
      });
    }
    await this.invalidateBusinessCache(businessId);
    return {
      success: true,
      progress: await this.getProgress(businessId),
      nextStep,
    };
  }

  async submit(businessId: number | null | undefined) {
    const id = this.requireBusinessId(businessId);
    const progress = await this.computeProgress(id);
    if (progress.nextStep) {
      throw new ConflictException({
        message: 'Onboarding is missing required steps',
        missingRequirements: progress.missingRequirements,
      });
    }

    await this.prisma.business.update({
      where: { id },
      data: { onboardingCompleted: true },
    });
    await this.prisma.user.updateMany({
      where: { businessId: id },
      data: { onboardingCompleted: true },
    });
    await this.invalidateBusinessCache(id);
    return this.getProgress(id);
  }

  async saveOwnerInformation(
    userId: number,
    businessId: number | null | undefined,
    dto: OwnerInformationDto,
  ) {
    const id = this.requireBusinessId(businessId);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
      },
    });
    await this.prisma.business.update({
      where: { id },
      data: {
        country: dto.location.country,
        streetAddress: dto.location.streetAddress,
        city: dto.location.city,
        state: dto.location.state,
        zipCode: dto.location.zipCode,
      },
    });
    return this.stepResponse(id);
  }

  async saveBusinessInformation(
    businessId: number | null | undefined,
    dto: BusinessInformationDto,
  ) {
    const id = this.requireBusinessId(businessId);
    await this.prisma.business.update({
      where: { id },
      data: {
        name: dto.businessName,
        businessType: BUSINESS_TYPE_MAP[dto.businessType],
        employeeCount: EMPLOYEE_COUNT_MAP[dto.employeeCount],
        country: dto.location.country,
        streetAddress: dto.location.streetAddress,
        city: dto.location.city,
        state: dto.location.state,
        zipCode: dto.location.zipCode,
      },
    });
    return this.stepResponse(id);
  }

  async saveBuildBusiness(
    businessId: number | null | undefined,
    dto: BuildBusinessDto,
  ) {
    const id = this.requireBusinessId(businessId);

    await this.prisma.$transaction(async (tx) => {
      await tx.business.update({
        where: { id },
        data: {
          workingHoursOpen: dto.workingHours.open,
          workingHoursClose: dto.workingHours.close,
        },
      });

      await tx.businessService.deleteMany({ where: { businessId: id } });
      for (const serviceId of dto.services) {
        const prices = dto.servicePrices?.[serviceId];
        await tx.businessService.create({
          data: {
            businessId: id,
            serviceId,
            priceMin: prices?.min ? prices.min : null,
            priceMax: prices?.max ? prices.max : null,
            enabled: true,
          },
        });
      }

      if (dto.categoryInventory) {
        await tx.businessInventory.deleteMany({ where: { businessId: id } });
        for (const [categoryId, configs] of Object.entries(
          dto.categoryInventory,
        )) {
          for (const [configKey, values] of Object.entries(configs)) {
            for (const value of values) {
              await tx.businessInventory.create({
                data: { businessId: id, categoryId, configKey, value },
              });
            }
          }
        }
      }
    });

    return this.stepResponse(id);
  }

  async saveBankDetails(
    businessId: number | null | undefined,
    dto: BankDetailsDto,
  ) {
    const id = this.requireBusinessId(businessId);
    await this.prisma.bankDetails.upsert({
      where: { businessId: id },
      create: {
        businessId: id,
        bankName: dto.bankName,
        accountHolder: dto.accountHolder,
        iban: dto.iban,
      },
      update: {
        bankName: dto.bankName,
        accountHolder: dto.accountHolder,
        iban: dto.iban,
      },
    });
    if (dto.accountNumber && dto.swift && dto.branch && dto.billingEmail) {
      await this.prisma.billingAccount.create({
        data: {
          businessId: id,
          bankName: dto.bankName,
          accountHolder: dto.accountHolder,
          accountNumber: dto.accountNumber,
          iban: dto.iban,
          swift: dto.swift,
          branch: dto.branch,
          billingEmail: dto.billingEmail,
        },
      });
    }
    return this.stepResponse(id);
  }

  async saveTwoFactor(
    userId: number,
    businessId: number | null | undefined,
    dto: TwoFactorAuthDto,
  ) {
    const id = this.requireBusinessId(businessId);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: dto.enabled ?? true,
        twoFactorMethod:
          dto.enabled === false ? null : TWO_FACTOR_MAP[dto.method],
        phoneNumber: dto.phone ?? undefined,
      },
    });
    return this.stepResponse(id);
  }

  private async invalidateBusinessCache(businessId: number) {
    await this.cache.del(
      cacheKeys.setupWarnings(businessId),
      cacheKeys.dashboardSummary(businessId),
    );
  }
}
