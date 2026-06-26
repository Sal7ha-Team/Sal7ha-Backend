import { Global, Module } from '@nestjs/common';
import { FirebaseCloudMessagingService } from './firebase-cloud-messaging.service';
import { NotificationDevicesController } from './notification-devices.controller';
import { NotificationsService } from './notifications.service';

@Global()
@Module({
  controllers: [NotificationDevicesController],
  providers: [FirebaseCloudMessagingService, NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
