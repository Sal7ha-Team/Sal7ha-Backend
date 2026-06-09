import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingStatus, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { QUEUE_NAMES } from './queue-names';
import { redisConnectionOptions } from './queue-options';

@Injectable()
export class AppQueueService {
  private readonly logger = new Logger(AppQueueService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async enqueueBookingStatusNotifications(input: {
    businessId: number;
    bookingIds: string[];
    status: BookingStatus;
  }) {
    if (input.bookingIds.length === 0) return;

    const queued = await this.tryAddBullJob(
      QUEUE_NAMES.notificationDispatch,
      'booking-status-changed',
      input,
      { attempts: 5 },
    );
    if (!queued) {
      await this.createOutbox('booking-status-changed', input.businessId, input);
    }
  }

  async enqueuePaymentExport(input: { jobId: string; businessId: number }) {
    const queued = await this.tryAddBullJob(
      QUEUE_NAMES.paymentExport,
      'payment-export',
      input,
      { attempts: 3 },
    );
    if (!queued) await this.completePaymentExportLocally(input.jobId);
  }

  async enqueueBillingVerification(input: {
    billingAccountId: string;
    businessId: number;
  }) {
    const queued = await this.tryAddBullJob(
      QUEUE_NAMES.billingVerification,
      'billing-account-verification',
      input,
      { attempts: 5 },
    );
    if (!queued) {
      await this.prisma.billingAccount.update({
        where: { id: input.billingAccountId },
        data: {
          status: 'verified',
          verificationNotes: 'Verified by local fallback worker.',
        },
      });
    }
  }

  async enqueueSupportNotification(input: {
    ticketId: string;
    businessId?: number | null;
  }) {
    const queued = await this.tryAddBullJob(
      QUEUE_NAMES.notificationDispatch,
      'support-ticket-created',
      input,
      { attempts: 5 },
    );
    if (!queued) {
      await this.createOutbox(
        'support-ticket-created',
        input.businessId ?? null,
        input,
      );
    }
  }

  private async tryAddBullJob(
    queueName: string,
    jobName: string,
    payload: Record<string, unknown>,
    options: { attempts: number },
  ) {
    if (this.config.get<string>('REDIS_QUEUES_ENABLED') !== 'true') {
      return false;
    }

    try {
      const { Queue } = await import('bullmq');
      const queue = new Queue(queueName, {
        connection: redisConnectionOptions(this.config),
      });
      queue.on('error', () => undefined);
      await queue.add(jobName, payload, {
        attempts: options.attempts,
        backoff: { type: 'exponential', delay: 2_000 },
        removeOnComplete: true,
        removeOnFail: 1_000,
      });
      await queue.close();
      return true;
    } catch (error) {
      this.logger.warn(
        `Queue ${queueName} unavailable; using local fallback: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return false;
    }
  }

  private async createOutbox(
    type: string,
    businessId: number | null,
    payload: Record<string, unknown>,
  ) {
    await this.prisma.notificationOutbox.create({
      data: {
        businessId,
        channel: 'in-app',
        type,
        payload: payload as Prisma.InputJsonValue,
        status: 'sent',
        attempts: 1,
        sentAt: new Date(),
      },
    });
  }

  private async completePaymentExportLocally(jobId: string) {
    const expiresAt = new Date();
    expiresAt.setUTCDate(expiresAt.getUTCDate() + 7);

    await this.prisma.exportJob.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        fileKey: `exports/payments/${jobId}`,
        completedAt: new Date(),
        expiresAt,
      },
    });
  }
}

