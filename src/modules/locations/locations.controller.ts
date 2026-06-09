import { Controller, Get, Query } from '@nestjs/common';
import { Public } from 'src/common/decorators/public.decorator';
import { LocationSearchDto, NearbyDto } from './dto/locations.dto';
import { LocationsService } from './locations.service';

@Public()
@Controller('locations')
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Get('search')
  search(@Query() query: LocationSearchDto) {
    return this.locations.search(query);
  }

  @Get('nearby')
  nearby(@Query() query: NearbyDto) {
    return this.locations.nearby(query);
  }
}
