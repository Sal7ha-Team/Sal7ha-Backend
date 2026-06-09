import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TwoFactorMethod, User } from '@prisma/client';
import { RedisCacheService } from 'src/common/cache/redis-cache.service';
import { cacheKeys } from 'src/common/cache/cache-keys';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  AccountProfileUpdateDto,
  MfaUpdateDto,
  NotificationPreferencesUpdateDto,
  SecuritySettingsUpdateDto,
} from './dto/account.dto';

const SECURITY_DEFAULTS = {
  loginAlerts: true,
  newDeviceApproval: true,
  sessionTimeout: true,
  paymentExportConfirmation: false,
};

const NOTIFICATION_DEFAULTS = {
  bookingAccepted: true,
  bookingDeclined: true,
  settingsSaved: true,
  securitySettingsUpdated: true,
  mfaUpdated: true,
  exportGenerated: true,
  storageItemSold: true,
};

@Injectable()
export class AccountService {
  constructor(
    private readonly cache: RedisCacheService,
    private readonly prisma: PrismaService,
  ) {}

  async profile(userId: number) {
    return this.serializeProfile(await this.getUser(userId));
  }

  async updateProfile(userId: number, dto: AccountProfileUpdateDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        phoneNumber: dto.phoneNumber,
        address: dto.address as Prisma.InputJsonValue,
      },
    });
    await this.invalidate(user);
    return this.serializeProfile(user);
  }

  async security(userId: number) {
    const user = await this.getUser(userId);
    return {
      preferences: this.preferenceList(
        { ...SECURITY_DEFAULTS, ...(user.securityPreferences as object) },
        {
          loginAlerts: 'Login alerts',
          newDeviceApproval: 'New device approval',
          sessionTimeout: 'Session timeout',
          paymentExportConfirmation: 'Payment export confirmation',
        },
      ),
      mfa: this.serializeMfa(user),
    };
  }

  async updateSecurity(userId: number, dto: SecuritySettingsUpdateDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { securityPreferences: dto.preferences },
    });
    await this.invalidate(user);
    return this.security(userId);
  }

  async updateMfa(userId: number, dto: MfaUpdateDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: dto.enabled,
        twoFactorMethod: dto.enabled
          ? ((dto.method ?? 'sms') as TwoFactorMethod)
          : null,
        mfaPhone: dto.phone ?? null,
      },
    });
    await this.invalidate(user);
    return this.serializeMfa(user);
  }

  async notificationPreferences(userId: number) {
    const user = await this.getUser(userId);
    return {
      preferences: this.preferenceList(
        {
          ...NOTIFICATION_DEFAULTS,
          ...(user.notificationPreferences as object),
        },
        {
          bookingAccepted: 'Booking accepted',
          bookingDeclined: 'Booking declined',
          settingsSaved: 'Settings saved',
          securitySettingsUpdated: 'Security settings updated',
          mfaUpdated: 'MFA updated',
          exportGenerated: 'Export generated',
          storageItemSold: 'Storage item sold',
        },
      ),
    };
  }

  async updateNotificationPreferences(
    userId: number,
    dto: NotificationPreferencesUpdateDto,
  ) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { notificationPreferences: dto.preferences },
    });
    await this.invalidate(user);
    return this.notificationPreferences(userId);
  }

  private async getUser(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private serializeProfile(user: User) {
    return {
      id: String(user.id),
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      birthDate: user.birthDate?.toISOString().slice(0, 10) ?? null,
      phoneNumber: user.phoneNumber,
      address: user.address,
      setupStatus:
        user.firstName && user.lastName && user.phoneNumber ? 'ok' : 'warning',
    };
  }

  private serializeMfa(user: User) {
    return {
      enabled: user.twoFactorEnabled,
      method: user.twoFactorMethod,
      phone: user.mfaPhone ?? user.phoneNumber,
      verifiedAt: user.twoFactorEnabled ? user.updatedAt : null,
    };
  }

  private preferenceList(
    values: Record<string, unknown>,
    titles: Record<string, string>,
  ) {
    return Object.entries(titles).map(([key, title]) => ({
      key,
      title,
      description: title,
      enabled: Boolean(values[key]),
    }));
  }

  private async invalidate(user: User) {
    if (!user.businessId) return;
    await this.cache.del(
      cacheKeys.setupWarnings(user.businessId),
      cacheKeys.dashboardSummary(user.businessId),
    );
  }
}
