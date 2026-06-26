import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';

@Module({
  controllers: [ServicesController, CatalogController],
  providers: [ServicesService],
})
export class ServicesModule {}
