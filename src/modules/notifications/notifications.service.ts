import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { BookingStatus, Prisma, User, UserRole } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  FirebaseCloudMessagingService,
  FcmSendResult,
} from './firebase-cloud-messaging.service';
import {
  RegisterNotificationDeviceDto,
  UnregisterNotificationDeviceDto,
} from './dto/notification-device.dto';

type NotificationData = Record<string, string | number | boolean | null>;

type NotifyUsersInput = {
  userIds: number[];
  businessId?: number | null;
  type: string;
  title: string;
  body: string;
  data?: NotificationData;
  preferenceKey?: string;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly fcm: FirebaseCloudMessagingService,
    private readonly prisma: PrismaService,
  ) {}

  async registerDevice(userId: number, dto: RegisterNotificationDeviceDto) {
    const token = dto.token.trim();
    if (!token) throw new BadRequestException('token is required');

    const device = await this.prisma.notificationDevice.upsert({
      where: { token },
      update: {
        userId,
        platform: dto.platform,
        client: dto.client ?? 'mobile',
        deviceId: dto.deviceId ?? null,
        enabled: true,
        lastSeenAt: new Date(),
      },
      create: {
        userId,
        token,
        platform: dto.platform,
        client: dto.client ?? 'mobile',
        deviceId: dto.deviceId ?? null,
      },
    });

    return this.serializeDevice(device);
  }

  async listDevices(userId: number) {
    const rows = await this.prisma.notificationDevice.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
    return { data: rows.map((row) => this.serializeDevice(row)) };
  }

  async unregisterDevice(userId: number, dto: UnregisterNotificationDeviceDto) {
    if (!dto.token && !dto.deviceId) {
      throw new BadRequestException('token or deviceId is required');
    }

    const result = await this.prisma.notificationDevice.updateMany({
      where: {
        userId,
        token: dto.token,
        deviceId: dto.deviceId,
      },
      data: {
        enabled: false,
        lastSeenAt: new Date(),
      },
    });

    return { disabled: result.count };
  }

  async notifyBusinessOwnersOfBookingCreated(bookingId: string) {
    return this.safeNotify('booking created', async () => {
      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          business: {
            include: {
              users: { where: { role: UserRole.business } },
            },
          },
          customer: true,
          service: true,
        },
      });
      if (!booking) return null;

      return this.notifyUsers({
        userIds: booking.business.users.map((user) => user.id),
        businessId: booking.businessId,
        type: 'booking.created',
        preferenceKey: 'newBooking',
        title: 'New booking request',
        body: `${this.customerName(booking.customer)} booked ${booking.service.name}.`,
        data: this.bookingData(booking, 'booking.created'),
      });
    });
  }

  async notifyBusinessOwnersOfBookingCancelled(bookingId: string) {
    return this.safeNotify('booking cancelled', async () => {
      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          business: {
            include: {
              users: { where: { role: UserRole.business } },
            },
          },
          customer: true,
          service: true,
        },
      });
      if (!booking) return null;

      return this.notifyUsers({
        userIds: booking.business.users.map((user) => user.id),
        businessId: booking.businessId,
        type: 'booking.cancelled_by_customer',
        preferenceKey: 'bookingCancelled',
        title: 'Booking cancelled',
        body: `${this.customerName(booking.customer)} cancelled ${booking.service.name}.`,
        data: this.bookingData(booking, 'booking.cancelled_by_customer'),
      });
    });
  }

  async notifyBookingStatusChanged(input: {
    businessId: number;
    bookingIds: string[];
    status: BookingStatus;
  }) {
    return this.safeNotify('booking status changed', async () => {
      const bookings = await this.prisma.booking.findMany({
        where: {
          id: { in: input.bookingIds },
          businessId: input.businessId,
        },
        include: {
          business: true,
          customer: true,
          service: true,
        },
      });

      const customerEmails = bookings
        .map((booking) => booking.customer.email)
        .filter((email): email is string => Boolean(email));
      if (customerEmails.length === 0) return null;

      const customers = await this.prisma.user.findMany({
        where: {
          email: { in: customerEmails },
          role: UserRole.client,
        },
      });
      const usersByEmail = new Map(customers.map((user) => [user.email, user]));

      const results: Array<
        Awaited<ReturnType<NotificationsService['notifyUsers']>>
      > = [];
      for (const booking of bookings) {
        const user = booking.customer.email
          ? usersByEmail.get(booking.customer.email)
          : undefined;
        if (!user) continue;

        const statusLabel = this.statusLabel(input.status);
        results.push(
          await this.notifyUsers({
            userIds: [user.id],
            businessId: booking.businessId,
            type: 'booking.status_changed',
            preferenceKey: this.statusPreferenceKey(input.status),
            title: `Booking ${statusLabel}`,
            body: `${booking.business.name} marked your ${booking.service.name} booking as ${statusLabel}.`,
            data: {
              ...this.bookingData(booking, 'booking.status_changed'),
              status: input.status,
            },
          }),
        );
      }

      return results;
    });
  }

  async notifyUsers(input: NotifyUsersInput) {
    const userIds = [...new Set(input.userIds.filter(Boolean))];
    if (userIds.length === 0) {
      return { inboxCount: 0, pushCount: 0 };
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
    });

    let inboxCount = 0;
    let pushCount = 0;

    for (const user of users) {
      if (!this.notificationEnabled(user, input.preferenceKey)) continue;

      await this.prisma.inboxMessage.create({
        data: {
          userId: user.id,
          businessId: input.businessId ?? null,
          title: input.title,
          body: input.body,
          type: input.type,
          data: (input.data ?? {}) as Prisma.InputJsonValue,
        },
      });
      inboxCount += 1;

      const push = await this.dispatchPush(user.id, input);
      pushCount += push.successCount;
    }

    return { inboxCount, pushCount };
  }

  private async dispatchPush(userId: number, input: NotifyUsersInput) {
    const devices = await this.prisma.notificationDevice.findMany({
      where: { userId, enabled: true },
    });
    const payload = {
      title: input.title,
      body: input.body,
      data: input.data ?? {},
      deviceCount: devices.length,
    };

    const outbox = await this.prisma.notificationOutbox.create({
      data: {
        businessId: input.businessId ?? null,
        userId,
        channel: 'push',
        type: input.type,
        payload: payload as Prisma.InputJsonValue,
        status: devices.length === 0 ? 'skipped' : 'pending',
        attempts: 0,
        sentAt: devices.length === 0 ? new Date() : null,
      },
    });

    if (devices.length === 0) {
      return this.emptyFcmResult(true);
    }

    if (!this.fcm.isConfigured()) {
      await this.updateOutbox(outbox.id, 'skipped', 0, {
        ...payload,
        reason: 'fcm_not_configured',
      });
      return this.emptyFcmResult(false);
    }

    try {
      const result = await this.fcm.sendToTokens(
        devices.map((device) => device.token),
        {
          title: input.title,
          body: input.body,
          data: input.data,
        },
      );

      if (result.invalidTokens.length > 0) {
        await this.prisma.notificationDevice.updateMany({
          where: { token: { in: result.invalidTokens } },
          data: { enabled: false },
        });
      }

      await this.updateOutbox(
        outbox.id,
        result.successCount > 0 ? 'sent' : 'failed',
        1,
        this.deliveryPayload(payload, result),
      );

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.prisma.notificationOutbox.update({
        where: { id: outbox.id },
        data: {
          status: 'failed',
          attempts: 1,
          nextAttemptAt: new Date(Date.now() + 5 * 60 * 1000),
          payload: {
            ...payload,
            error: message,
          } as Prisma.InputJsonValue,
        },
      });
      this.logger.warn(`Push delivery failed: ${message}`);
      return this.emptyFcmResult(true);
    }
  }

  private async updateOutbox(
    id: string,
    status: string,
    attempts: number,
    payload: Record<string, unknown>,
  ) {
    await this.prisma.notificationOutbox.update({
      where: { id },
      data: {
        status,
        attempts,
        payload: payload as Prisma.InputJsonValue,
        sentAt: status === 'failed' ? null : new Date(),
        nextAttemptAt:
          status === 'failed' ? new Date(Date.now() + 5 * 60 * 1000) : null,
      },
    });
  }

  private deliveryPayload(
    payload: Record<string, unknown>,
    result: FcmSendResult,
  ) {
    return {
      ...payload,
      configured: result.configured,
      successCount: result.successCount,
      failureCount: result.failureCount,
      invalidTokenCount: result.invalidTokens.length,
      errors: result.errors
        .slice(0, 5)
        .map((error) => ({ message: error.message })),
    };
  }

  private emptyFcmResult(configured: boolean): FcmSendResult {
    return {
      configured,
      successCount: 0,
      failureCount: 0,
      invalidTokens: [],
      errors: [],
    };
  }

  private bookingData(
    booking: {
      id: string;
      businessId: number;
      startDate: Date;
      service: { id: string; name: string };
    },
    event: string,
  ): NotificationData {
    return {
      event,
      bookingId: booking.id,
      businessId: booking.businessId,
      serviceId: booking.service.id,
      serviceName: booking.service.name,
      scheduledDate: booking.startDate.toISOString().slice(0, 10),
      url: `/bookings/${booking.id}`,
    };
  }

  private customerName(customer: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
  }) {
    return (
      [customer.firstName, customer.lastName]
        .filter(Boolean)
        .join(' ')
        .trim() ||
      customer.email ||
      'A customer'
    );
  }

  private notificationEnabled(user: User, key?: string) {
    if (!key) return true;
    const preferences = this.record(user.notificationPreferences);
    return preferences[key] === undefined ? true : Boolean(preferences[key]);
  }

  private statusPreferenceKey(status: BookingStatus) {
    switch (status) {
      case BookingStatus.Accepted:
        return 'bookingAccepted';
      case BookingStatus.Cancelled:
        return 'bookingCancelled';
      case BookingStatus.Completed:
        return 'bookingCompleted';
      case BookingStatus.In_Progress:
        return 'bookingInProgress';
      case BookingStatus.Pending:
      default:
        return 'bookingStatusUpdated';
    }
  }

  private statusLabel(status: BookingStatus) {
    switch (status) {
      case BookingStatus.Accepted:
        return 'accepted';
      case BookingStatus.Cancelled:
        return 'cancelled';
      case BookingStatus.Completed:
        return 'completed';
      case BookingStatus.In_Progress:
        return 'in progress';
      case BookingStatus.Pending:
      default:
        return 'pending';
    }
  }

  private serializeDevice(device: {
    id: string;
    token: string;
    platform: string;
    client: string;
    deviceId: string | null;
    enabled: boolean;
    lastSeenAt: Date;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: device.id,
      tokenPreview: `${device.token.slice(0, 10)}...${device.token.slice(-6)}`,
      platform: device.platform,
      client: device.client,
      deviceId: device.deviceId,
      enabled: device.enabled,
      lastSeenAt: device.lastSeenAt,
      createdAt: device.createdAt,
      updatedAt: device.updatedAt,
    };
  }

  private async safeNotify<T>(
    event: string,
    callback: () => Promise<T>,
  ): Promise<T | null> {
    try {
      return await callback();
    } catch (error) {
      this.logger.warn(
        `Notification for ${event} failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  private record(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return {};
  }
}
