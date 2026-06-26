import { Module } from '@nestjs/common';
import {
  AiLiveController,
  AiPersistenceController,
  MobileAccountController,
  MobileNotificationsController,
  MobilePaymentsController,
  MobileUploadsController,
  ShopChatController,
  ShopsController,
} from './mobile.controller';
import { MobileService } from './mobile.service';

@Module({
  controllers: [
    MobileAccountController,
    ShopsController,
    MobilePaymentsController,
    MobileNotificationsController,
    ShopChatController,
    MobileUploadsController,
    AiPersistenceController,
    AiLiveController,
  ],
  providers: [MobileService],
  exports: [MobileService],
})
export class MobileModule {}
