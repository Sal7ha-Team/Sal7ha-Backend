import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Prisma } from '@prisma/client';
import { Job } from 'bullmq';
import { PrismaService } from 'src/prisma/prisma.service';
import { QUEUE_NAMES } from './queue-names';

@Processor(QUEUE_NAMES.paymentExport)
export class PaymentExportProcessor extends WorkerHost {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<{ jobId: string }>) {
    await this.prisma.exportJob.update({
      where: { id: job.data.jobId },
      data: { status: 'processing' },
    });

    const expiresAt = new Date();
    expiresAt.setUTCDate(expiresAt.getUTCDate() + 7);

    await this.prisma.exportJob.update({
      where: { id: job.data.jobId },
      data: {
        status: 'completed',
        fileKey: `exports/payments/${job.data.jobId}`,
        completedAt: new Date(),
        expiresAt,
      },
    });
  }
}

@Processor(QUEUE_NAMES.billingVerification)
export class BillingVerificationProcessor extends WorkerHost {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<{ billingAccountId: string }>) {
    await this.prisma.billingAccount.update({
      where: { id: job.data.billingAccountId },
      data: {
        status: 'verified',
        verificationNotes: 'Verified by local verification worker.',
      },
    });
  }
}

@Processor(QUEUE_NAMES.notificationDispatch)
export class NotificationDispatchProcessor extends WorkerHost {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<Record<string, unknown>>) {
    await this.prisma.notificationOutbox.create({
      data: {
        businessId:
          typeof job.data.businessId === 'number' ? job.data.businessId : null,
        channel: 'in-app',
        type: job.name,
        payload: job.data as Prisma.InputJsonValue,
        status: 'sent',
        attempts: job.attemptsMade + 1,
        sentAt: new Date(),
      },
    });
  }
}
