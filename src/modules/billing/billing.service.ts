import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BillingAccount } from '@prisma/client';
import { RedisCacheService } from 'src/common/cache/redis-cache.service';
import { cacheKeys, CACHE_TTL_SECONDS } from 'src/common/cache/cache-keys';
import { AppQueueService } from 'src/common/queues/app-queue.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { BankAccountCreateDto, BankAccountUpdateDto } from './dto/billing.dto';

const SUPPORTED_BANKS = [
  {
    name: 'CIB Bank',
    imageUrl: '/banks_images/CIB Bank.png',
    supportsBulkPayment: true,
  },
  {
    name: 'QNB Alahli',
    imageUrl: '/banks_images/QNB Alahli.png',
    supportsBulkPayment: true,
  },
  {
    name: 'Banque Misr',
    imageUrl: '/banks_images/Banque Misr.png',
    supportsBulkPayment: false,
  },
  {
    name: 'National Bank of Egypt',
    imageUrl: '/banks_images/NBE.png',
    supportsBulkPayment: true,
  },
];

@Injectable()
export class BillingService {
  constructor(
    private readonly cache: RedisCacheService,
    private readonly queues: AppQueueService,
    private readonly prisma: PrismaService,
  ) {}

  private requireBusiness(businessId: number | null | undefined) {
    if (!businessId) throw new BadRequestException('No business context');
    return businessId;
  }

  async banks() {
    return this.cache.remember(
      cacheKeys.banksCatalog(),
      CACHE_TTL_SECONDS.banksCatalog,
      async () => SUPPORTED_BANKS,
    );
  }

  async list(businessId: number | null | undefined) {
    const rows = await this.prisma.billingAccount.findMany({
      where: { businessId: this.requireBusiness(businessId) },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.serialize(row));
  }

  async create(
    businessId: number | null | undefined,
    dto: BankAccountCreateDto,
  ) {
    const bid = this.requireBusiness(businessId);
    const row = await this.prisma.billingAccount.create({
      data: { businessId: bid, ...dto },
    });
    await this.invalidate(bid);
    return this.serialize(row);
  }

  async get(businessId: number | null | undefined, id: string) {
    const row = await this.prisma.billingAccount.findFirst({
      where: { id, businessId: this.requireBusiness(businessId) },
    });
    if (!row) throw new NotFoundException('Billing account not found');
    return this.serialize(row);
  }

  async update(
    businessId: number | null | undefined,
    id: string,
    dto: BankAccountUpdateDto,
  ) {
    const bid = this.requireBusiness(businessId);
    await this.get(bid, id);
    const row = await this.prisma.billingAccount.update({
      where: { id },
      data: dto,
    });
    await this.invalidate(bid);
    return this.serialize(row);
  }

  async remove(businessId: number | null | undefined, id: string) {
    const bid = this.requireBusiness(businessId);
    const account = await this.prisma.billingAccount.findFirst({
      where: { id, businessId: bid },
    });
    if (!account) throw new NotFoundException('Billing account not found');
    if (account.status !== 'draft') {
      throw new ConflictException('Only draft billing accounts can be deleted');
    }
    await this.prisma.billingAccount.delete({ where: { id } });
    await this.invalidate(bid);
  }

  async submit(businessId: number | null | undefined, id: string) {
    const bid = this.requireBusiness(businessId);
    const account = await this.prisma.billingAccount.findFirst({
      where: { id, businessId: bid },
    });
    if (!account) throw new NotFoundException('Billing account not found');
    if (account.status !== 'draft' && account.status !== 'rejected') {
      throw new ConflictException('Billing account cannot be submitted');
    }
    const row = await this.prisma.billingAccount.update({
      where: { id },
      data: { status: 'pending_review', submittedAt: new Date() },
    });
    await this.invalidate(bid);
    await this.queues.enqueueBillingVerification({
      billingAccountId: id,
      businessId: bid,
    });
    return this.serialize(row);
  }

  private serialize(row: BillingAccount) {
    return {
      id: row.id,
      businessId: String(row.businessId),
      bankName: row.bankName,
      accountHolder: row.accountHolder,
      accountNumber: row.accountNumber,
      iban: row.iban,
      swift: row.swift,
      branch: row.branch,
      billingEmail: row.billingEmail,
      status: row.status,
      verificationNotes: row.verificationNotes,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      submittedAt: row.submittedAt,
    };
  }

  private async invalidate(businessId: number) {
    await this.cache.del(
      cacheKeys.setupWarnings(businessId),
      cacheKeys.dashboardSummary(businessId),
    );
  }
}
