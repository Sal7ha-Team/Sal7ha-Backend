import { Controller, Get } from '@nestjs/common';
import { Public } from 'src/common/decorators/public.decorator';
import { ServicesService } from './services.service';

@Controller()
export class CatalogController {
  constructor(private readonly services: ServicesService) {}

  @Public()
  @Get('service-categories')
  categories() {
    return this.services.categories();
  }

  @Public()
  @Get('oil-brands')
  oilBrands() {
    return this.services.oilBrands();
  }
}
