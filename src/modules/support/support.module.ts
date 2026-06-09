import { Module } from '@nestjs/common';
import { FeedbackController, SupportController } from './support.controller';
import { SupportService } from './support.service';

@Module({
  controllers: [SupportController, FeedbackController],
  providers: [SupportService],
})
export class SupportModule {}
