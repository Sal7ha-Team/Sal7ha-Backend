import { Module } from '@nestjs/common';
import { MobileModule } from '../mobile/mobile.module';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

@Module({
  imports: [MobileModule],
  controllers: [BookingsController],
  providers: [BookingsService],
})
export class BookingsModule {}
