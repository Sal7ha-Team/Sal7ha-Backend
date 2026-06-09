import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ExportJob, Payment, PaymentRefund, Prisma } from '@prisma/client';
import { AppQueueService } from 'src/common/queues/app-queue.service';
import { RedisCacheService } from 'src/common/cache/redis-cache.service';
import { cacheKeys, CACHE_TTL_SECONDS } from 'src/common/cache/cache-keys';
import { pagination, paginationMeta } from 'src/common/utils/pagination.util';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  BatchRefundPaymentsDto,
  PaymentExportCreateDto,
  PaymentQueryDto,
  PaymentSummaryQueryDto,
  RefundPaymentDto,
} from './dto/payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly cache: RedisCacheService,
    private readonly queues: AppQueueService,
    private readonly prisma: PrismaService,
  ) {}

  private requireBusiness(businessId: number | null | undefined) {
    if (!businessId) throw new BadRequestException('No business context');
    return businessId;
  }

  async list(businessId: number | null | undefined, query: PaymentQueryDto) {
    const bid = this.requireBusiness(businessId);
    const page = pagination(query);
    const where = this.where(bid, query);
    const [total, rows, summary] = await Promise.all([
      this.prisma.payment.count({ where }),
      this.prisma.payment.findMany({
        where,
        orderBy: this.orderBy(query),
        skip: page.skip,
        take: page.take,
      }),
      this.summary(bid, query),
    ]);
    return {
      data: rows.map((row) => this.serializePayment(row)),
      summary,
      pagination: paginationMeta(total, page.page, page.limit),
    };
  }

  async summary(
    businessId: number | null | undefined,
    query: PaymentSummaryQueryDto,
  ) {
    const bid = this.requireBusiness(businessId);
    return this.cache.remember(
      cacheKeys.paymentSummary(bid, query.startDate, query.endDate),
      CACHE_TTL_SECONDS.paymentSummary,
      () => this.computeSummary(bid, query),
    );
  }

  async get(businessId: number | null | undefined, id: string) {
    const row = await this.prisma.payment.findFirst({
      where: { id, businessId: this.requireBusiness(businessId) },
    });
    if (!row) throw new NotFoundException('Payment not found');
    return this.serializePayment(row);
  }

  async refund(
    businessId: number | null | undefined,
    userId: number,
    id: string,
    dto: RefundPaymentDto,
  ) {
    const payment = await this.prisma.payment.findFirst({
      where: { id, businessId: this.requireBusiness(businessId) },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    const amount = dto.amount ?? Number(payment.amount);
    if (amount <= 0 || amount > Number(payment.amount)) {
      throw new BadRequestException('Refund amount is invalid');
    }
    const refund = await this.prisma.paymentRefund.create({
      data: {
        paymentId: id,
        amount,
        reason: dto.reason ?? null,
        status: 'succeeded',
        createdBy: userId,
      },
    });
    await this.prisma.payment.update({
      where: { id },
      data: {
        status:
          amount === Number(payment.amount) ? 'refunded' : 'partially_refunded',
      },
    });
    await this.invalidate(payment.businessId);
    return this.serializeRefund(refund);
  }

  async batchRefund(
    businessId: number | null | undefined,
    userId: number,
    dto: BatchRefundPaymentsDto,
  ) {
    let succeeded = 0;
    const failedIds: string[] = [];
    for (const id of dto.ids) {
      try {
        await this.refund(businessId, userId, id, { reason: dto.reason });
        succeeded += 1;
      } catch {
        failedIds.push(id);
      }
    }
    return {
      requested: dto.ids.length,
      succeeded,
      failed: failedIds.length,
      failedIds,
    };
  }

  async createExportJob(
    businessId: number | null | undefined,
    userId: number,
    dto: PaymentExportCreateDto,
  ) {
    const bid = this.requireBusiness(businessId);
    const matchedCount = await this.prisma.payment.count({
      where: {
        businessId: bid,
        kind: { in: dto.categories },
        id: dto.paymentIds?.length ? { in: dto.paymentIds } : undefined,
      },
    });
    const job = await this.prisma.exportJob.create({
      data: {
        businessId: bid,
        userId,
        type: 'payment-export',
        status: 'queued',
        format: dto.format,
        filters: dto as unknown as Prisma.JsonObject,
        matchedCount,
      },
    });
    await this.queues.enqueuePaymentExport({ jobId: job.id, businessId: bid });
    return this.serializeJob(job);
  }

  async getExportJob(businessId: number | null | undefined, id: string) {
    const job = await this.prisma.exportJob.findFirst({
      where: { id, businessId: this.requireBusiness(businessId) },
    });
    if (!job) throw new NotFoundException('Export job not found');
    return this.serializeJob(job);
  }

  async downloadExport(businessId: number | null | undefined, id: string) {
    const job = await this.prisma.exportJob.findFirst({
      where: { id, businessId: this.requireBusiness(businessId) },
    });
    if (!job) throw new NotFoundException('Export job not found');
    if (job.status !== 'completed') {
      throw new ConflictException('Export is not complete yet');
    }
    const filters = job.filters as unknown as PaymentExportCreateDto;
    const payments = await this.prisma.payment.findMany({
      where: {
        businessId: job.businessId,
        kind: filters.categories?.length
          ? { in: filters.categories }
          : undefined,
        id: filters.paymentIds?.length ? { in: filters.paymentIds } : undefined,
        date:
          filters.startDate || filters.endDate
            ? {
                gte: filters.startDate
                  ? new Date(filters.startDate)
                  : undefined,
                lte: filters.endDate ? new Date(filters.endDate) : undefined,
              }
            : undefined,
      },
      orderBy: { date: 'desc' },
    });
    const rows = payments.map((payment) => this.serializePayment(payment));
    const json = JSON.stringify(
      { job: this.serializeJob(job), data: rows },
      null,
      2,
    );
    const csv = [
      'id,item,method,date,amount,currency,kind,status',
      ...rows.map((row) =>
        [
          row.id,
          row.item,
          row.method,
          row.date,
          row.amount,
          row.currency,
          row.kind,
          row.status,
        ].join(','),
      ),
    ].join('\n');

    if (job.format === 'pdf') {
      return {
        contentType: 'application/pdf',
        filename: `${job.id}.pdf`,
        content: Buffer.from(`%PDF-1.4\n% Payment export\n${json}\n%%EOF`),
      };
    }
    if (job.format === 'word') {
      return {
        contentType: 'application/msword',
        filename: `${job.id}.doc`,
        content: Buffer.from(json),
      };
    }
    if (job.format === 'google-docs') {
      return {
        contentType: 'text/html',
        filename: `${job.id}.html`,
        content: Buffer.from(`<pre>${this.escapeHtml(json)}</pre>`),
      };
    }
    if (job.format === 'dashboard') {
      return {
        contentType: 'application/json',
        filename: `${job.id}.json`,
        content: Buffer.from(json),
      };
    }
    return {
      contentType: 'application/vnd.ms-excel',
      filename: `${job.id}.csv`,
      content: Buffer.from(csv),
    };
  }

  private async computeSummary(
    businessId: number,
    query: PaymentSummaryQueryDto,
  ) {
    const now = new Date();
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    const where = this.where(businessId, query);
    const [monthly, yearly, itemsSold, servicesDone] = await Promise.all([
      this.prisma.payment.aggregate({
        where: { ...where, date: { gte: monthStart } },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: { ...where, date: { gte: yearStart } },
        _sum: { amount: true },
      }),
      this.prisma.inventoryTransaction.aggregate({
        where: { businessId, type: 'sale' },
        _sum: { quantity: true },
      }),
      this.prisma.booking.count({
        where: { businessId, status: 'Completed' },
      }),
    ]);
    return {
      monthlyPayments: Number(monthly._sum.amount ?? 0),
      yearlyPayments: Number(yearly._sum.amount ?? 0),
      itemsSold: itemsSold._sum.quantity ?? 0,
      servicesDone,
      currency: 'USD',
    };
  }

  private where(
    businessId: number,
    query: PaymentSummaryQueryDto & Partial<PaymentQueryDto>,
  ) {
    return {
      businessId,
      method: query.method,
      kind: query.kind,
      date:
        query.startDate || query.endDate
          ? {
              gte: query.startDate ? new Date(query.startDate) : undefined,
              lte: query.endDate ? new Date(query.endDate) : undefined,
            }
          : undefined,
      ...(query.search
        ? {
            OR: [
              { id: { contains: query.search, mode: 'insensitive' as const } },
              {
                item: { contains: query.search, mode: 'insensitive' as const },
              },
              {
                method: {
                  contains: query.search,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
    };
  }

  private orderBy(
    query: PaymentQueryDto,
  ): Prisma.PaymentOrderByWithRelationInput {
    const dir = query.sortOrder ?? 'desc';
    switch (query.sortBy) {
      case 'id':
        return { id: dir };
      case 'method':
        return { method: dir };
      case 'amount':
        return { amount: dir };
      case 'item':
        return { item: dir };
      case 'date':
      default:
        return { date: dir };
    }
  }

  private serializePayment(row: Payment) {
    return {
      id: row.id,
      businessId: String(row.businessId),
      customerId: row.customerId ? String(row.customerId) : null,
      customer: '',
      bookingId: row.bookingId,
      inventoryItemId: row.inventoryItemId,
      item: row.item,
      method: row.method,
      date: row.date.toISOString().slice(0, 10),
      amount: Number(row.amount),
      currency: row.currency,
      kind: row.kind,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private serializeRefund(row: PaymentRefund) {
    return {
      id: row.id,
      paymentId: row.paymentId,
      amount: Number(row.amount),
      reason: row.reason,
      status: row.status,
      createdAt: row.createdAt,
    };
  }

  private serializeJob(row: ExportJob) {
    return {
      id: row.id,
      type: row.type,
      status: row.status,
      format: row.format,
      filters: row.filters,
      matchedCount: row.matchedCount,
      downloadUrl:
        row.status === 'completed'
          ? `/payments/export-jobs/${row.id}/download`
          : null,
      errorMessage: row.errorMessage,
      createdAt: row.createdAt,
      completedAt: row.completedAt,
      expiresAt: row.expiresAt,
    };
  }

  private async invalidate(businessId: number) {
    await this.cache.deleteByPattern(
      `business:${businessId}:payments:summary:*`,
    );
    await this.cache.deleteByPattern(
      `business:${businessId}:reports:application-stats:*`,
    );
    await this.cache.del(cacheKeys.dashboardSummary(businessId));
  }

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
