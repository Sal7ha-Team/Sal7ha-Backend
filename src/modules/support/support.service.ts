import { Injectable } from '@nestjs/common';
import { Feedback, SupportTicket } from '@prisma/client';
import { RedisCacheService } from 'src/common/cache/redis-cache.service';
import { cacheKeys, CACHE_TTL_SECONDS } from 'src/common/cache/cache-keys';
import { AppQueueService } from 'src/common/queues/app-queue.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { FeedbackCreateDto, SupportTicketCreateDto } from './dto/support.dto';

@Injectable()
export class SupportService {
  constructor(
    private readonly cache: RedisCacheService,
    private readonly queues: AppQueueService,
    private readonly prisma: PrismaService,
  ) {}

  async helpCenter(locale = 'en') {
    return this.cache.remember(
      cacheKeys.helpCenter(locale),
      CACHE_TTL_SECONDS.helpCenter,
      async () => ({
        categories: [
          {
            id: 'getting-started',
            title: locale === 'ar' ? 'البداية' : 'Getting started',
            articles: [
              {
                id: 'setup-business',
                title:
                  locale === 'ar' ? 'إعداد النشاط' : 'Set up your business',
                body:
                  locale === 'ar'
                    ? 'أكمل بيانات النشاط والخدمات والحساب البنكي.'
                    : 'Complete business details, services, and billing account setup.',
              },
            ],
          },
          {
            id: 'payments',
            title: locale === 'ar' ? 'المدفوعات' : 'Payments',
            articles: [
              {
                id: 'exports',
                title: locale === 'ar' ? 'تصدير المدفوعات' : 'Export payments',
                body:
                  locale === 'ar'
                    ? 'أنشئ ملف تصدير من صفحة المدفوعات.'
                    : 'Create export jobs from the payments page.',
              },
            ],
          },
        ],
      }),
    );
  }

  async createTicket(
    user: { sub: number; businessId?: number | null; email: string },
    dto: SupportTicketCreateDto,
  ) {
    const row = await this.prisma.supportTicket.create({
      data: {
        businessId: user.businessId ?? null,
        userId: user.sub,
        subject: dto.subject,
        message: dto.message,
        email: dto.email ?? user.email,
        priority: dto.priority ?? 'normal',
      },
    });
    await this.queues.enqueueSupportNotification({
      ticketId: row.id,
      businessId: user.businessId,
    });
    return this.serializeTicket(row);
  }

  async createFeedback(
    user: { sub: number; businessId?: number | null },
    dto: FeedbackCreateDto,
  ) {
    const row = await this.prisma.feedback.create({
      data: {
        businessId: user.businessId ?? null,
        userId: user.sub,
        message: dto.message,
        rating: dto.rating ?? null,
        page: dto.page ?? null,
      },
    });
    return this.serializeFeedback(row);
  }

  private serializeTicket(row: SupportTicket) {
    return {
      id: row.id,
      subject: row.subject,
      message: row.message,
      status: row.status,
      createdAt: row.createdAt,
    };
  }

  private serializeFeedback(row: Feedback) {
    return {
      id: row.id,
      message: row.message,
      rating: row.rating,
      page: row.page,
      createdAt: row.createdAt,
    };
  }
}
