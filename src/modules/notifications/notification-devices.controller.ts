import { Body, Controller, Delete, Get, Post } from '@nestjs/common';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { JwtUser } from 'src/common/decorators/current-user.decorator';
import {
  RegisterNotificationDeviceDto,
  UnregisterNotificationDeviceDto,
} from './dto/notification-device.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications/devices')
export class NotificationDevicesController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: JwtUser) {
    return this.notifications.listDevices(user.sub);
  }

  @Post()
  register(
    @CurrentUser() user: JwtUser,
    @Body() dto: RegisterNotificationDeviceDto,
  ) {
    return this.notifications.registerDevice(user.sub, dto);
  }

  @Delete()
  unregister(
    @CurrentUser() user: JwtUser,
    @Body() dto: UnregisterNotificationDeviceDto,
  ) {
    return this.notifications.unregisterDevice(user.sub, dto);
  }

  @Post('unregister')
  unregisterWithPost(
    @CurrentUser() user: JwtUser,
    @Body() dto: UnregisterNotificationDeviceDto,
  ) {
    return this.unregister(user, dto);
  }
}
