import { Global, Module } from '@nestjs/common';
import { AppQueueService } from './app-queue.service';

@Global()
@Module({
  providers: [AppQueueService],
  exports: [AppQueueService],
})
export class QueueModule {}
