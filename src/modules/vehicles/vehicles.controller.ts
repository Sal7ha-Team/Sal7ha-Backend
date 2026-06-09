import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { JwtUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import {
  VehicleCreateDto,
  VehicleQueryDto,
  VehicleUpdateDto,
} from './dto/vehicle.dto';
import { VehiclesService } from './vehicles.service';

@Roles(UserRole.business)
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehicles: VehiclesService) {}

  @Get()
  list(@CurrentUser() user: JwtUser, @Query() query: VehicleQueryDto) {
    return this.vehicles.list(user.businessId, query);
  }

  @Post()
  create(@CurrentUser() user: JwtUser, @Body() dto: VehicleCreateDto) {
    return this.vehicles.create(user.businessId, dto);
  }

  @Get(':vehicleId')
  get(@CurrentUser() user: JwtUser, @Param('vehicleId') id: string) {
    return this.vehicles.get(user.businessId, id);
  }

  @Patch(':vehicleId')
  update(
    @CurrentUser() user: JwtUser,
    @Param('vehicleId') id: string,
    @Body() dto: VehicleUpdateDto,
  ) {
    return this.vehicles.update(user.businessId, id, dto);
  }
}
