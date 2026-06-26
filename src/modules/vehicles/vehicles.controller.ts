import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { JwtUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { VehicleQueryDto } from './dto/vehicle.dto';
import { MobileService } from '../mobile/mobile.service';
import { VehiclesService } from './vehicles.service';

@Roles(UserRole.business, UserRole.client)
@Controller('vehicles')
export class VehiclesController {
  constructor(
    private readonly vehicles: VehiclesService,
    private readonly mobile: MobileService,
  ) {}

  @Get()
  list(@CurrentUser() user: JwtUser, @Query() query: VehicleQueryDto) {
    if (user.role === UserRole.client) {
      return this.mobile.listVehicles(user.sub);
    }
    return this.vehicles.list(user.businessId, query);
  }

  @Post()
  create(@CurrentUser() user: JwtUser, @Body() dto: any) {
    if (user.role === UserRole.client) {
      return this.mobile.createVehicle(user.sub, dto);
    }
    return this.vehicles.create(user.businessId, dto);
  }

  @Get(':vehicleId')
  get(@CurrentUser() user: JwtUser, @Param('vehicleId') id: string) {
    if (user.role === UserRole.client) {
      return this.mobile.getVehicle(user.sub, id);
    }
    return this.vehicles.get(user.businessId, id);
  }

  @Patch(':vehicleId')
  update(
    @CurrentUser() user: JwtUser,
    @Param('vehicleId') id: string,
    @Body() dto: any,
  ) {
    if (user.role === UserRole.client) {
      return this.mobile.updateVehicle(user.sub, id, dto);
    }
    return this.vehicles.update(user.businessId, id, dto);
  }

  @Roles(UserRole.client)
  @Delete(':vehicleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: JwtUser, @Param('vehicleId') id: string) {
    return this.mobile.deleteVehicle(user.sub, id);
  }
}
