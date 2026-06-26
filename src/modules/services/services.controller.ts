import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { Public } from 'src/common/decorators/public.decorator';
import { ServicesService } from './services.service';

@Controller('services')
export class ServicesController {
  constructor(private services: ServicesService) {}

  @Public()
  @Get('catalog')
  catalog() {
    return this.services.catalog();
  }

  @Public()
  @Get()
  list(@Query() query: any) {
    return this.services.services(query);
  }

  @Public()
  @Get(':serviceId')
  async get(@Param('serviceId') serviceId: string) {
    const service = await this.services.service(serviceId);
    if (!service) throw new NotFoundException('Service not found');
    return service;
  }
}
